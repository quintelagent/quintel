#!/usr/bin/env node
// node scripts/smoke.mjs /path "text that must be on the page" — opens the live page in a real browser.
import { chromium } from '@playwright/test';
const [path, text] = process.argv.slice(2), b = await chromium.launch(), bad = [];
for (const width of [390, 1440]) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  p.on('pageerror', (e) => bad.push(String(e).slice(0, 120)));
  const r = await p.goto('https://quintelagent.com' + path, { waitUntil: 'load' });
  await p.waitForTimeout(5000);
  if (!r.ok()) bad.push(`HTTP ${r.status()}`);
  const body = await p.evaluate(() => document.body.innerText);
  if (!body.includes(text)) bad.push(`"${text}" not found at ${width}px`);
  if (/NaN|undefined|\[object/.test(body)) bad.push('broken text');
  if (await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) bad.push(`sideways scroll at ${width}px`);
}
await b.close();
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`${path} ok at 390 and 1440`);
