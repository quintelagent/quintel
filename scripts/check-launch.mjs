#!/usr/bin/env node
// node scripts/check-launch.mjs [--live]  — the CA must be exactly the same everywhere. --live checks the deployed site and GitHub.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)), live = process.argv.includes('--live'), { ca } = JSON.parse(readFileSync(ROOT + 'launch.json', 'utf8'));
if (!ca) { console.error('launch.json has no CA yet.'); process.exit(1); }
const bad = [], ok = (what, has) => { console.log(`${has ? 'match   ' : 'MISSING '} ${what}`); if (!has) bad.push(what); };
const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => r.text(), () => '');
// any other 0x address sitting in a token row would be a mistake
if (!live) for (const f of ['README.md', 'DEPLOYMENTS.md', 'TRUST.md', 'wrangler.jsonc', 'web/dist/index.html', 'web/dist/token.json']) { let s = ''; try { s = readFileSync(ROOT + f, 'utf8'); } catch { /* not built */ } ok(f, s.includes(ca)); }
else {
  const S = 'https://quintelagent.com', G = 'https://raw.githubusercontent.com/quintelagent/quintel/main/';
  ok('page head', (await get(S + '/')).includes(ca));
  const t = JSON.parse((await get(S + '/token.json')) || '{}'); ok('/token.json', t.contract === ca);
  ok('/api/config', JSON.parse((await get(S + '/api/config')) || '{}').tokens?.pons === ca);
  for (const f of ['README.md', 'DEPLOYMENTS.md', 'TRUST.md']) ok('GitHub ' + f, (await get(G + f + '?' + Date.now())).includes(ca));
  const { chromium } = await import('@playwright/test'); const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(S + '/', { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const seen = async (sel) => p.locator(sel).first().evaluate((e) => [e.textContent, ...[...e.querySelectorAll('[data-ca]')].map((x) => x.getAttribute('data-ca'))].join(' ')).catch(() => '');
  ok('CA bar', (await seen('.ca-bar')).includes(ca)); ok('token section', (await seen('#token')).includes(ca)); await b.close();
}
if (bad.length) { console.error(`\n${bad.length} place(s) do not match ${ca}`); process.exit(1); }
console.log(`\nAll match ${ca}`);
