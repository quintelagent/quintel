/**
 * MCP over streamable HTTP: stateless, read-only, no sessions. Both eras on one endpoint:
 * per-request metadata (2026-07-28) and the older initialize handshake. Spec: modelcontextprotocol.io/specification
 * Tool calls read the public API in-process, so they share its cache and never reach the database on their own.
 * Nothing a client sends is logged or stored.
 */
import { MCP_TOOLS, type McpInput, type McpTool } from '../../web/src/lib/mcpTools';
import { callTool, TOOL_FAILED, type Get } from './mcpTools';

const MODERN = '2026-07-28';
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SUPPORTED = [MODERN, ...LEGACY];
const BATCH_VERSION = '2025-03-26'; // the only revision with batches
const MAX_BODY = 64 * 1024, MAX_BATCH = 10;
const META = 'io.modelcontextprotocol/';
const INFO = { name: 'quintel', title: 'Quintel', version: '1.0.0', websiteUrl: 'https://quintelagent.com' };
const INSTRUCTIONS = 'Quintel runs 1,000,000 futures of NVDA every 10 minutes while the market is open (30 minutes while it is closed) and publishes the odds. Report them as scenario odds from a model, with the run number and its time in Eastern. They are not advice. Every run can be verified at https://quintelagent.com/verify.';
const CACHE = { ttlMs: 300_000, cacheScope: 'public' };

const TOOLS = MCP_TOOLS.map((t: McpTool) => ({
  name: t.name, title: t.title, description: t.description,
  inputSchema: { type: 'object', properties: t.inputs, required: t.required, additionalProperties: false },
  annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}));

const HEADERS = {
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id',
  'access-control-max-age': '86400',
};
type Id = string | number | null;
type Obj = Record<string, unknown>;
interface Reply { status: number; body: Obj | Obj[] | null }
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const send = ({ status, body }: Reply, extra: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...HEADERS, ...(body === null ? {} : { 'content-type': 'application/json' }), ...extra } });
const fail = (status: number, code: number, message: string, id: Id = null, data?: unknown): Reply => ({ status, body: { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } } });

/** null when the body is larger than the limit; stops reading as soon as it is */
async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length')) > MAX_BODY) return null;
  const reader = req.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if ((size += value.byteLength) > MAX_BODY) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

/** One plain sentence when the arguments do not fit the tool, else null. Never repeats what was sent. */
export function badArgs(tool: McpTool, args: Obj): string | null {
  const known = Object.keys(tool.inputs);
  if (Object.keys(args).some((k) => !known.includes(k))) return known.length ? `${tool.name} takes only: ${known.join(', ')}.` : `${tool.name} takes no inputs.`;
  for (const [k, i] of Object.entries(tool.inputs) as [string, McpInput][]) {
    const v = args[k];
    if (v === undefined) { if (tool.required.includes(k)) return `${k} is required. ${i.description}.`; continue; }
    if (i.type === 'string') { if (typeof v !== 'string' || (i.enum && !i.enum.includes(v))) return `${k} must be one of: ${i.enum?.join(', ')}.`; continue; }
    const num = typeof v === 'number' && Number.isFinite(v) ? v : null;
    const low = i.exclusiveMinimum !== undefined ? `above ${i.exclusiveMinimum}` : `${i.minimum} or more`;
    if (num === null || (i.type === 'integer' && !Number.isInteger(num)) || (i.exclusiveMinimum !== undefined && num <= i.exclusiveMinimum) || (i.minimum !== undefined && num < i.minimum) || (i.maximum !== undefined && num > i.maximum)) {
      return `${k} must be a ${i.type === 'integer' ? 'whole ' : ''}number, ${low} and at most ${i.maximum}.`;
    }
  }
  return null;
}

/** a header value may carry base64 so it stays plain ASCII */
function headerText(v: string | null): string | null {
  const m = v?.match(/^=\?base64\?(.*)\?=$/);
  if (!m) return v;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch { return null; }
}

async function handleOne(msg: unknown, headers: Headers, get: Get): Promise<Reply> {
  if (!isObj(msg) || msg.jsonrpc !== '2.0') return fail(400, -32600, 'Invalid request');
  const hasId = typeof msg.id === 'string' || (typeof msg.id === 'number' && Number.isInteger(msg.id));
  if (typeof msg.method !== 'string') return 'result' in msg || 'error' in msg ? { status: 202, body: null } : fail(400, -32600, 'Invalid request', hasId ? (msg.id as Id) : null);
  if (!('id' in msg)) return { status: 202, body: null }; // a notification: nothing to do, nothing to answer
  if (!hasId) return fail(400, -32600, 'Invalid request: id must be a string or a whole number');

  const id = msg.id as Id, method = msg.method;
  if (msg.params !== undefined && !isObj(msg.params)) return fail(200, -32602, 'Invalid params', id);
  const params = (msg.params ?? {}) as Obj;
  const meta = isObj(params._meta) ? params._meta : {};
  const asked = meta[META + 'protocolVersion'], header = headers.get('mcp-protocol-version');
  const modern = asked !== undefined || (method !== 'initialize' && header !== null && !LEGACY.includes(header));

  if (modern) {
    const mismatch = (name: string) => fail(400, -32020, `Header mismatch: ${name} is missing or does not match the body`, id);
    if (asked === undefined ? header === MODERN : asked !== header) return mismatch('MCP-Protocol-Version');
    if (header !== MODERN) return fail(400, -32022, 'Unsupported protocol version', id, { supported: SUPPORTED, requested: header });
    if (headers.get('mcp-method') !== method) return mismatch('Mcp-Method');
    if (method === 'tools/call' && headerText(headers.get('mcp-name')) !== params.name) return mismatch('Mcp-Name');
    if (!isObj(meta[META + 'clientCapabilities'])) return fail(400, -32602, 'Invalid params: _meta needs clientCapabilities', id);
  }
  const ok = (result: Obj, cache = false): Reply => ({ status: 200, body: { jsonrpc: '2.0', id, result: modern ? { resultType: 'complete', ...result, ...(cache ? CACHE : {}), _meta: { [META + 'serverInfo']: INFO } } : result } });

  if (method === 'tools/list') return ok({ tools: TOOLS }, true);
  if (method === 'tools/call') {
    const tool = MCP_TOOLS.find((t) => t.name === params.name);
    if (!tool) return fail(200, -32602, 'Unknown tool', id);
    if (params.arguments !== undefined && !isObj(params.arguments)) return fail(200, -32602, 'Invalid params: arguments must be an object', id);
    const args = params.arguments ?? {};
    const bad = badArgs(tool, args);
    const r = bad ? { text: bad, isError: true } : await callTool(tool.name, args, get).catch(() => TOOL_FAILED);
    return ok({ content: [{ type: 'text', text: r.text }], ...('data' in r ? { structuredContent: r.data } : {}), isError: 'isError' in r });
  }
  if (modern && method === 'server/discover') return ok({ supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions: INSTRUCTIONS }, true);
  if (!modern && method === 'ping') return ok({});
  if (!modern && method === 'initialize') {
    if (typeof params.protocolVersion !== 'string') return fail(200, -32602, 'Invalid params: protocolVersion is required', id);
    return ok({ protocolVersion: LEGACY.includes(params.protocolVersion) ? params.protocolVersion : LEGACY[0], capabilities: { tools: {} }, serverInfo: INFO, instructions: INSTRUCTIONS });
  }
  return fail(modern ? 404 : 200, -32601, 'Method not found', id);
}

/** Any web origin may read it, like the rest of the public API: no cookies, no keys, nothing private. */
export async function handleMcp(req: Request, get: Get): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return send(fail(405, -32000, 'Method not allowed. Use POST.'), { allow: 'POST, OPTIONS' });
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return send(fail(415, -32000, 'Content-Type must be application/json'));
  const accept = req.headers.get('accept');
  if (accept && !/application\/(json|\*)|\*\/\*/i.test(accept)) return send(fail(406, -32000, 'Accept must include application/json'));
  const text = await readBody(req).catch(() => '');
  if (text === null) return send(fail(413, -32000, 'The request is larger than 64 KB'));
  let msg: unknown;
  try { msg = JSON.parse(text); } catch { return send(fail(400, -32700, 'Parse error')); }
  try {
    if (!Array.isArray(msg)) return send(await handleOne(msg, req.headers, get));
    const version = req.headers.get('mcp-protocol-version') ?? BATCH_VERSION;
    if (version !== BATCH_VERSION || !msg.length || msg.length > MAX_BATCH) return send(fail(400, -32600, 'Send one message per request'));
    const replies = (await Promise.all(msg.map((m) => handleOne(m, req.headers, get)))).flatMap((r) => (r.body === null ? [] : [r.body as Obj]));
    return send(replies.length ? { status: 200, body: replies } : { status: 202, body: null });
  } catch { return send(fail(500, -32603, 'Internal error')); }
}
