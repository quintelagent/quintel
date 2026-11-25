import type { Env } from './config';
import { workerFlag } from './flags';
import { handleApi } from './api';
import { tick } from './cron';
import { safeError } from './redact';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.hostname === 'www.quintelagent.com') {
      url.hostname = 'quintelagent.com';
      return Response.redirect(url.toString(), 301);
    }
    // MCP clients look here for a sign-in. There is none, and the site's page must not answer in its place.
    if (/^\/\.well-known\/(oauth-|openid-)/.test(url.pathname) && workerFlag(env, 'MCP_SERVER')) return new Response('Not found', { status: 404, headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, env, ctx, (e, force) => tick(e, new Date(), { force }));
    }
    const res = await env.ASSETS.fetch(req);
    // a file that does not exist is a 404, not the app page
    if (res.status === 200 && /\.[a-z0-9]{2,11}$/i.test(url.pathname) && !/\.html$/i.test(url.pathname) && (res.headers.get('content-type') ?? '').startsWith('text/html')) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return res;
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      tick(env).then(
        (r) => console.log(JSON.stringify(r)),
        (e) => console.error('tick failed', safeError(e, env)),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
