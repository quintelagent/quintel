import type { Env } from './config';
import { handleApi } from './api';
import { tick } from './cron';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, env, ctx, (e, force) => tick(e, new Date(), { force }));
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      tick(env).then(
        (r) => console.log(JSON.stringify(r)),
        (e) => console.error('tick failed', e),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
