import { useCallback, useEffect, useState } from 'react';
import { featureByFlag } from '../features';
import { useData } from '../lib/data';
import { usd } from '../lib/format';
import { useLaptop } from '../lib/hooks';
import { inputsLabel, MCP_TOOLS, MCP_URL, type McpTool } from '../lib/mcpTools';
import { backAboveOf } from '../lib/metrics';
import { useMeta } from '../lib/meta';
import { Link } from '../lib/router';
import { DEFAULT_SYMBOL } from '../lib/symbols';
import { Button, Card, CodeBlock, DataTable, Pill, SegmentedTabs, Skeleton, type TabItem } from '../components/ui';
import './mcp.css';

type AppId = 'claude' | 'cursor';
const APPS: TabItem<AppId>[] = [{ id: 'claude', label: 'Claude' }, { id: 'cursor', label: 'Cursor' }];
const CLAUDE_CODE = `claude mcp add --transport http quintel --scope user ${MCP_URL}`;
const CURSOR_JSON = JSON.stringify({ mcpServers: { quintel: { url: MCP_URL } } }, null, 2);
const TOOLS: readonly McpTool[] = MCP_TOOLS;

type Health = 'checking' | 'ok' | 'down';
/** Asks the server itself, once a minute while the tab is visible. */
function useServer(online: boolean): { health: Health; check: () => void } {
  const [health, set] = useState<Health>('checking');
  const [n, again] = useState(0);
  useEffect(() => {
    if (!online) return;
    let alive = true, t = 0;
    const ping = async () => {
      const stop = new AbortController(), timer = window.setTimeout(() => stop.abort(), 8000);
      let up = false;
      try {
        const r = await fetch('/api/mcp', { method: 'POST', cache: 'no-store', signal: stop.signal, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' });
        up = r.ok && !!(await r.json()).result;
      } catch { /* down */ } finally { clearTimeout(timer); }
      if (alive) set(up ? 'ok' : 'down');
    };
    const vis = () => { clearInterval(t); if (document.hidden) return; ping(); t = window.setInterval(ping, 60000); };
    vis();
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [online, n]);
  return { health, check: useCallback(() => { set('checking'); again((x) => x + 1); }, []) };
}

function ServerLine() {
  const { online } = useData();
  const { health, check } = useServer(online);
  return (
    <div className="mcp-server" role="status">
      {!online ? <p className="note">Offline · updates paused</p>
        : health === 'checking' ? <Skeleton h={28} w={160} />
        : health === 'ok' ? <><Pill>OK</Pill><p className="note">The server is answering.</p></>
        : <><Pill tone="risk">Down</Pill><p className="note">The MCP server is down right now. <Link href="/status">Check status.</Link></p><Button variant="secondary" onClick={check}>Try again</Button></>}
    </div>
  );
}

function Steps({ app, question }: { app: AppId; question: string }) {
  const name = app === 'claude' ? 'Claude' : 'Cursor';
  return (
    <ol className="mcp-steps">
      <Card as="li">
        <h2><span className="label">1</span>Copy the server address</h2>
        <p>No account and no key.</p>
        <CodeBlock code={MCP_URL} />
      </Card>
      <Card as="li">
        <h2><span className="label">2</span>Add it to {name}</h2>
        {app === 'claude' ? (
          <>
            <p>Open Customize, then Connectors. Select Add, then Add custom connector. Name it Quintel, paste the address and choose No sign-in.</p>
            <p className="note">On Team and Enterprise plans an Owner adds it first, in Organization settings under Connectors. The Free plan has room for one custom connector.</p>
            <p>In Claude Code, run this.</p>
            <CodeBlock code={CLAUDE_CODE} />
          </>
        ) : (
          <>
            <p>Add this to ~/.cursor/mcp.json for every project, or .cursor/mcp.json for one.</p>
            <CodeBlock code={CURSOR_JSON} />
            <p className="note">If the file already lists servers, add only the quintel entry. Turn it on or off under Customize.</p>
          </>
        )}
      </Card>
      <Card as="li">
        <h2><span className="label">3</span>Ask a question</h2>
        <p>{app === 'claude' ? 'In a chat, open the plus menu, turn Quintel on under Connectors, then ask.' : 'Open a new chat and ask.'}</p>
        <CodeBlock code={question} />
      </Card>
    </ol>
  );
}

const Tools = () => (useLaptop() ? (
  <DataTable caption="Tools" rows={[...TOOLS]} rowKey={(t) => t.name} columns={[
    { key: 'name', head: 'Tool', cell: (t) => t.name, mono: true },
    { key: 'what', head: 'What it returns', cell: (t) => t.oneLine },
    { key: 'in', head: 'Inputs', cell: inputsLabel, mono: true },
  ]} />
) : (
  <ul className="mcp-cards">
    {TOOLS.map((t) => (
      <Card as="li" key={t.name}>
        <h3 className="mono">{t.name}</h3>
        <p>{t.oneLine}</p>
        <p className="label">Inputs: {inputsLabel(t)}</p>
      </Card>
    ))}
  </ul>
));

export function Mcp() {
  useMeta('Use Quintel from your AI · Quintel', featureByFlag('MCP_SERVER')!.oneLine);
  const { latest } = useData();
  const [app, setApp] = useState<AppId>('claude');
  // the level each run tracks, so the example is always one the server answers both ways
  const level = backAboveOf(latest?.run?.summary)?.level ?? 186.64;
  const question = `What are the odds ${DEFAULT_SYMBOL} is above ${usd(level)} in a month?`;
  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head mcp-head">
          <h1>Use Quintel from your AI.</h1>
          <p>Ask Claude or Cursor for the latest scenario odds, briefings and proofs.</p>
          <ServerLine />
        </header>
        <div className="mcp">
          <div>
            <div className="mcp-tabs"><SegmentedTabs items={APPS} value={app} onChange={setApp} label="App" idBase="mcp" /></div>
            {APPS.map(({ id }) => <div key={id} className="mcp-panel" role="tabpanel" id={`mcp-panel-${id}`} aria-labelledby={`mcp-tab-${id}`} hidden={id !== app}><Steps app={id} question={question} /></div>)}
          </div>
          <div className="mcp-side">
            <section aria-labelledby="mcp-tools">
              <h2 id="mcp-tools">Tools</h2>
              <Tools />
            </section>
            <Card><p>Read-only. Quintel never trades, never sees your wallet, and never stores your questions.</p><p className="note">Scenario odds, not advice.</p></Card>
            <div className="row"><Button variant="secondary" href="/status">Server status</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
