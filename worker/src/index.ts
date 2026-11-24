import type { Env } from './config';
import { handleApi } from './api';
import { tick } from './cron';
import { workerFlag } from './flags';
import { safeError } from './redact';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.hostname === 'www.quintelagent.com') {
      url.hostname = 'quintelagent.com';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, env, ctx, (e, force) => tick(e, new Date(), { force }));
    }
    // MCP clients look here for a sign-in. There is none, and the site's page must not answer in its place.
    if (/^\/\.well-known\/(oauth-|openid-)/.test(url.pathname) && workerFlag(env, 'MCP_SERVER')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
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
