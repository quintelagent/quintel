#!/usr/bin/env node
// npm run ship <FLAG> [--off]
// Releases one feature: flips it in web/src/features.ts (which /status reads) and adds a CHANGELOG entry.
// It does not deploy. Review, commit as "Ship: <feature name>", then deploy.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const flag = process.argv[2];
const off = process.argv.includes('--off');
const F = root('web/src/features.ts'), C = root('CHANGELOG.md');
const src = readFileSync(F, 'utf8');
const all = [...src.matchAll(/flag: '([A-Z_]+)', on: (true|false), name: '([^']+)', oneLine: '([^']+)'/g)];
const f = all.find((m) => m[1] === flag);
if (!f) { console.error(`Unknown flag: ${flag ?? '(none)'}\nFlags: ${all.map((m) => m[1]).join(', ')}`); process.exit(1); }
if ((f[2] === 'true') !== off) { console.error(`${flag} is already ${off ? 'off' : 'on'}.`); process.exit(1); }

const now = new Date();
const next = src.split('\n').map((l) => {
  if (!l.includes(`flag: '${flag}'`)) return l;
  return l.replace(/on: (true|false)/, `on: ${!off}`).replace(/status: '\w+'/, `status: '${off ? 'soon' : 'live'}'`).replace(/shippedAt: (null|'[^']*')/, `shippedAt: ${off ? 'null' : `'${now.toISOString()}'`}`);
}).join('\n');
writeFileSync(F, next);

const day = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const time = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase() + ' ET';
const head = `## ${day}`;
const line = off ? `- **${f[3]} is turned off** · ${time}.` : `- **${f[3]} is live** · ${time}. ${f[4]}`;
let log = readFileSync(C, 'utf8');
if (log.includes(head + '\n')) log = log.replace(head + '\n', `${head}\n${line}\n`);
else log = log.replace(/\n## /, `\n${head}\n${line}\n\n## `);
writeFileSync(C, log);
console.log(`${flag} ${off ? 'off' : 'on'}: ${f[3]}`);
