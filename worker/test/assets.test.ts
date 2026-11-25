import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const files: Record<string, [string, string]> = { '/': ['<!doctype html>', 'text/html; charset=utf-8'], '/assets/a-1.js': ['x', 'text/javascript'], '/manifest.webmanifest': ['{}', 'application/manifest+json'] };
// like the asset server: an unknown path gets the app page
const env = { ASSETS: { fetch: async (r: Request) => { const [b, t] = files[new URL(r.url).pathname] ?? files['/']; return new Response(b, { headers: { 'content-type': t } }); } } } as any;
const status = async (p: string) => (await worker.fetch(new Request('https://quintelagent.com' + p), env, {} as any)).status;

describe('missing files', () => {
  it('real files and app routes are served', async () => {
    for (const p of ['/', '/status', '/verify?run=1', '/docs/readme', '/briefings/91', '/assets/a-1.js', '/manifest.webmanifest']) expect([p, await status(p)]).toEqual([p, 200]);
  });
  it('a missing file is a 404', async () => {
    for (const p of ['/token.json', '/sitemap.xml', '/favicon.ico', '/assets/old-1.js', '/x.webmanifest']) expect([p, await status(p)]).toEqual([p, 404]);
  });
});
