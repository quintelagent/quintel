/** Read-only preview: static site + GET proxy to the production API. */
interface Env { ASSETS: { fetch(req: Request): Promise<Response> } }
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    let res: Response;
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' || url.pathname.startsWith('/api/admin')) return new Response('read-only preview', { status: 405 });
      res = await fetch('https://quintelagent.com' + url.pathname + url.search, { headers: { accept: 'application/json' } });
    } else res = await env.ASSETS.fetch(req);
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', 'noindex, nofollow');
    return out;
  },
};
