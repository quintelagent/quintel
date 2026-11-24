#!/usr/bin/env node
// npm run check:design — fails if the site breaks docs/design/SYSTEM.md section 15.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk(join(ROOT, 'web/src')).filter((f) => /\.(tsx?|css)$/.test(f));
const bad = [];
const add = (f, i, rule, text) => bad.push(`${relative(ROOT, f)}:${i + 1}  ${rule}  ${text.trim().slice(0, 100)}`);

// theme-color, the manifest and image assets need literal colors: only the six tokens are allowed there
const tokens = [...readFileSync(join(ROOT, 'web/src/styles/tokens.css'), 'utf8').matchAll(/--[\w-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
for (const f of ['web/index.html', 'web/public/manifest.webmanifest', 'web/public/favicon.svg', 'web/scripts/og.html', 'web/scripts/render-og.mjs'].map((f) => join(ROOT, f)).filter(existsSync)) {
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => { for (const m of l.matchAll(/#[0-9a-f]{6}\b/gi)) if (!tokens.includes(m[0].toLowerCase())) add(f, i, 'color not in tokens', m[0]); });
}

const BANNED = /\b(predict(s|ed|ion|ions|ing)?|forecast(s|ed|ing)?|guarantee[ds]?|moon|pump|100x|revolutionary|insane|alpha|signals?|you should|buy now|crisis)\b/i;
const BRAND = /nvidia|nvda|jensen|huang|cuda/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const allowed = (s) => s.replace(/pump\.fun/gi, '').replace(/not (a )?predictions?/gi, '').replace(/are these predictions\?/gi, '');
/** text a person can read: JSX text plus string literals that hold prose (a space, or a capitalised word) */
function uiText(code) {
  const out = [];
  code.split('\n').forEach((line, i) => {
    const l = line.replace(/^\s*\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/^\s*\*.*$/, '').replace(/\s\/\/ .*$/, '');
    if (/^\s*import\b/.test(l)) return;
    for (const m of l.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}=;]*[A-Za-z][^<>{}=;]*)</g)) {
      const s = m[1] ?? m[2] ?? m[3] ?? m[4];
      const text = (s ?? '').replace(/\$\{[^}]*\}/g, ' ');
      if (text && (/\s/.test(text.trim()) || m[4] !== undefined || /^[A-Z][a-z]+$/.test(text))) out.push([i, text]);
    }
  });
  return out;
}

for (const f of src) {
  const code = readFileSync(f, 'utf8'), css = f.endsWith('.css');
  code.split('\n').forEach((l, i) => {
    if (!f.endsWith('styles/tokens.css') && /#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?\b/i.test(l.replace(/&#\w+;/g, '')) && (css ? /:[^;]*#[0-9a-f]{3,8}\b/i.test(l) : /['"`#]#?[0-9a-f]{6}\b['"`]/i.test(l) || /['"`]#[0-9a-f]{3,8}['"`]/i.test(l))) add(f, i, 'hex outside tokens.css', l);
    if (/from ['"](three|lenis|gsap)|import\(['"](three|lenis|gsap)/.test(l)) add(f, i, 'banned library', l);
    if (/backdrop-?filter/i.test(l)) add(f, i, 'backdrop-filter', l);
    if (/(@media[^{]*|matchMedia\([^)]*|useMedia\([^)]*)max-width/.test(l)) add(f, i, 'max-width media query', l);
  });
  if (!css) {
    for (const [i, t] of uiText(code)) {
      if (EMOJI.test(t.replace(/[©®™✓]/g, ''))) add(f, i, 'emoji', t);
      const m = allowed(t).match(BANNED);
      // the one place old stored wording is mapped to current wording
      if (m && !f.endsWith('lib/briefing.ts')) add(f, i, `banned word "${m[0]}"`, t);
    }
    for (const m of code.matchAll(/export (?:default )?(?:function|const|class) (\w+)/g)) if (BRAND.test(m[1])) add(f, code.slice(0, m.index).split('\n').length - 1, 'brand in component name', m[1]);
  }
  if (BRAND.test(relative(ROOT, f))) add(f, 0, 'brand in file name', f);
}
const reg = join(ROOT, 'web/src/features.ts');
readFileSync(reg, 'utf8').split('\n').forEach((l, i) => {
  const name = l.match(/name: '([^']+)'/)?.[1], route = l.match(/route: '([^']+)'/)?.[1], doc = l.match(/doc: '([^']+)'/)?.[1];
  if (!name || l.includes('interface')) return;
  if (BRAND.test(name)) add(reg, i, 'brand in feature name', name);
  if (route && BRAND.test(route)) add(reg, i, 'brand in route', route);
  const live = /status: 'live'/.test(l);
  if ((live && !doc) || (doc && !existsSync(join(ROOT, 'docs/design/features', doc + '.md')))) add(reg, i, 'no design file', name);
});
for (const f of walk(join(ROOT, 'web/public'))) if (BRAND.test(relative(join(ROOT, 'web/public'), f))) add(f, 0, 'brand in asset', f);

if (bad.length) { console.error(bad.join('\n') + `\n\ncheck:design: ${bad.length} problem${bad.length > 1 ? 's' : ''}`); process.exit(1); }
console.log(`check:design: ok (${src.length} files)`);
