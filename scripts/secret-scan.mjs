#!/usr/bin/env node
// Blocks secrets and private files from being committed.
//   node scripts/secret-scan.mjs            staged changes (pre-commit hook)
//   node scripts/secret-scan.mjs --all      every tracked file (CI)
//   node scripts/secret-scan.mjs --history  every version of every file, and every commit identity
// Findings never print the value, only where it is.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 });

export const FORBIDDEN_PATHS = [/(^|\/)private\//, /(^|\/)\.dev\.vars/, /(^|\/)\.env(\.|$)/, /launch[_-]?plan/i, /\.(pem|p12|pfx|key|keystore)$/i, /(^|\/)id_(rsa|ed25519)/];
export const RULES = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['OpenRouter key', /\bsk-or-v1-[0-9a-f]{20,}/],
  ['Anthropic key', /\bsk-ant-[\w-]{20,}/],
  ['OpenAI style key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{40,})/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Alpaca key', /\b(?:PK|AK)[A-Z0-9]{18}\b/],
  ['Slack or Discord webhook', /hooks\.slack\.com\/services\/\w|discord(?:app)?\.com\/api\/webhooks\/\d/],
  ['Telegram bot token', /\b\d{8,10}:AA[\w-]{32,}/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._-]{24,}/],
  ['RPC URL with a key', /https?:\/\/[^\s'"`]*(?:alchemy|infura|quiknode|ankr)[^\s'"`]*\/[A-Za-z0-9_-]{20,}/i],
  // a 64-hex value next to a key-like name (hashes and test vectors have other names)
  ['raw private key', /(?:private[_-]?key|fingerprint_key|secret|mnemonic|seed[_-]?phrase)["'`]?\s*[:=]\s*["'`]?(?:0x)?[0-9a-fA-F]{64}\b/i],
  ['secret in an assignment', /\b(?:OPENROUTER_API_KEY|ALPACA_KEY_ID|ALPACA_SECRET_KEY|FINNHUB_API_KEY|FINGERPRINT_KEY|ADMIN_TOKEN|NTFY_TOPIC)\s*[:=]\s*["'`]?(?!generate|env\b|process\b|undefined|null|your|\$|<|x{3})[A-Za-z0-9+/_-]{12,}/],
  ['personal email', /\b[\w.+-]+@(?:gmail|icloud|yahoo|hotmail|outlook|proton(?:mail)?)\.(?:com|me)\b/i],
];
export const findings = (text) => RULES.filter(([, re]) => re.test(text)).map(([n]) => n);
export const badPath = (p) => FORBIDDEN_PATHS.some((re) => re.test(p));
export const okIdentity = (s) => /^Quintel <(?:build@quintelagent\.com|\d+\+[\w-]+@users\.noreply\.github\.com)>$/.test(s);

function main() {
  const mode = process.argv[2];
  const bad = [];
  const check = (where, text) => text.split('\n').forEach((l, i) => findings(l).forEach((n) => bad.push(`${where}:${i + 1}  ${n}`)));
  if (mode === '--all') {
    for (const f of git('ls-files', '-z').split('\0').filter(Boolean)) {
      if (badPath(f)) { bad.push(`${f}  must never be in the repo`); continue; }
      if (f === 'package-lock.json' || /\.(png|woff2|ico)$/.test(f) || !existsSync(ROOT + f)) continue;
      check(f, readFileSync(ROOT + f, 'utf8'));
    }
  } else if (mode === '--history') {
    for (const f of new Set(git('log', '--all', '--name-only', '--format=').split('\n').filter(Boolean))) if (badPath(f)) bad.push(`${f}  in history`);
    for (const l of git('log', '--all', '-p', '--no-color', '--format=commit %h', '--', '.', ':!package-lock.json').split('\n')) {
      if (l.startsWith('commit ')) main.at = l;
      else if (l.startsWith('+') && !l.startsWith('+++')) findings(l).forEach((n) => bad.push(`${main.at}  ${n}`));
    }
    for (const id of new Set(git('log', '--all', '--format=%an <%ae>%n%cn <%ce>').split('\n').filter(Boolean))) if (!okIdentity(id)) bad.push('a commit identity that is not Quintel');
  } else {
    for (const f of git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean)) {
      if (badPath(f)) { bad.push(`${f}  must never be committed`); continue; }
      if (f === 'package-lock.json' || /\.(png|woff2|ico)$/.test(f)) continue;
      git('diff', '--cached', '-U0', '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).forEach((l) => findings(l).forEach((n) => bad.push(`${f}  ${n}`)));
    }
    for (const v of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
      const id = git('var', v).replace(/ \d+ [+-]\d{4}\s*$/, '').trim();
      if (!okIdentity(id)) bad.push('commit identity is not Quintel: run  git config user.name Quintel  and  git config user.email build@quintelagent.com');
    }
  }
  if (bad.length) { console.error([...new Set(bad)].join('\n') + '\n\nsecret-scan: stopped. Nothing was committed.'); process.exit(1); }
  console.log('secret-scan: ok');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
