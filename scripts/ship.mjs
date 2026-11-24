#!/usr/bin/env node
// npm run ship <FLAG>              release a feature
// npm run ship <FLAG> -- --dry-run show every step, change nothing
// npm run ship <FLAG> -- --off     turn a released feature off again
//
// Release: merge the feature's PR (merge commit), flip its flag, add a CHANGELOG entry, test, build, deploy,
// check the live site, create a GitHub Release, print the X post draft. /status reads the same flag.
// The X post is only ever printed and saved to private/x-drafts/. Nothing is posted.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { addChangelog, clearOfRuns, etTime, listFlags, nextVersion, releaseNotes, setFlag, xDraft } from './ship-lib.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const F = ROOT + 'web/src/features.ts', C = ROOT + 'CHANGELOG.md';
const args = process.argv.slice(2), flag = args.find((a) => !a.startsWith('--')), has = (o) => args.includes('--' + o);
const dry = has('dry-run'), off = has('off');
const run = (cmd, a, o = {}) => execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...o });
const git = (...a) => run('git', a).trim();
const gh = (...a) => run('gh', a).trim();
const die = (m) => { console.error('\nStopped: ' + m); process.exit(1); };
const step = (m) => console.log((dry ? 'would  ' : '-> ') + m);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

const flags = listFlags(readFileSync(F, 'utf8'));
const f = flags.find((x) => x.flag === flag);
if (!f) die(`unknown flag ${flag ?? '(none)'}\nFlags: ${flags.map((x) => `${x.flag}${x.on ? ' (on)' : ''}`).join(', ')}`);
if (f.on !== off) die(`${flag} is already ${f.on ? 'on' : 'off'}.`);

// ---- checks before anything changes
if (git('branch', '--show-current') !== 'main') die('switch to main first.');
if (git('status', '--porcelain')) die('commit or stash your changes first.');
if (git('config', 'user.name') !== 'Quintel') die('git user.name is not Quintel.');
run('node', ['scripts/secret-scan.mjs', '--all']);
git('fetch', '-q', 'origin', 'main');
if (git('rev-parse', 'main') !== git('rev-parse', 'origin/main')) die('main is not the same as origin/main. Pull or push first.');

const branch = `feature/${f.id}`;
let pr = null;
if (!off) {
  const open = JSON.parse(gh('pr', 'list', '--state', 'open', '--base', 'main', '--head', branch, '--json', 'number,title,mergeable'));
  if (!open.length) die(`no open PR from ${branch} to main. Build the feature there first.`);
  pr = open[0];
  if (pr.mergeable === 'CONFLICTING') die(`PR ${pr.number} has conflicts with main.`);
  const checks = JSON.parse(gh('pr', 'checks', String(pr.number), '--json', 'name,state'));
  const bad = checks.filter((c) => c.state !== 'SUCCESS');
  if (!checks.length || bad.length) die(`PR ${pr.number} checks are not green: ${bad.map((c) => `${c.name} ${c.state}`).join(', ') || 'none ran'}.`);
}
const version = off ? null : nextVersion(git('ls-remote', '--tags', 'origin').split('\n').map((l) => l.split('refs/tags/')[1] ?? ''));

console.log(`\n${off ? 'Turn off' : 'Release'}: ${f.name} (${flag})`);
if (pr) step(`merge PR ${pr.number} "${pr.title}" with a merge commit`);
step(`set ${flag} ${off ? 'off' : 'on'} in web/src/features.ts (this also updates /status)`);
step('add the CHANGELOG entry');
step('run tests, build, deploy to quintelagent.com between run times, check the live site');
if (version) step(`create GitHub Release ${version}`);
console.log(`\nX draft (not posted):\n---\n${off ? '(none)' : xDraft(f)}\n---`);
if (dry) process.exit(0);
if (!has('yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = (await rl.question('\nType the flag name to go ahead: ')).trim() === flag;
  rl.close();
  if (!ok) die('not confirmed. Nothing changed.');
}

// ---- release
if (pr) {
  step(`merging PR ${pr.number}`);
  gh('pr', 'ready', String(pr.number));
  gh('pr', 'merge', String(pr.number), '--merge');
  git('pull', '-q', '--ff-only', 'origin', 'main');
}
const now = new Date();
writeFileSync(F, setFlag(readFileSync(F, 'utf8'), flag, !off, now.toISOString()));
writeFileSync(C, addChangelog(readFileSync(C, 'utf8'), f, !off, now));
step('testing and building');
try {
  run('npm', ['run', 'typecheck'], { stdio: 'pipe' });
  run('npm', ['test'], { stdio: 'pipe' });
  run('npm', ['run', 'build'], { stdio: 'pipe' });
} catch (e) {
  git('checkout', '--', 'web/src/features.ts', 'CHANGELOG.md');
  die(`tests or build failed, so the flag was left ${off ? 'on' : 'off'} and nothing was deployed.${pr ? ` PR ${pr.number} is merged, with its flag still off.` : ''}\n${String(e.stdout ?? '').slice(-1500)}`);
}
git('add', 'web/src/features.ts', 'CHANGELOG.md');
git('commit', '-q', '-m', off ? `Ship: turn off ${f.name}` : `Ship: ${f.name} is live`);
git('push', '-q', 'origin', 'main');
while (!clearOfRuns(new Date())) { console.log('   waiting for the run to finish'); await wait(20); }
step('deploying');
run('npx', ['--no-install', 'wrangler', 'deploy'], { stdio: 'pipe' });
const js = readdirSync(ROOT + 'web/dist/assets').find((n) => /^index-.*\.js$/.test(n));
let live = false;
for (let i = 0; i < 12 && !live; i++) { await wait(5); live = (await fetch('https://quintelagent.com/', { cache: 'no-store' }).then((r) => r.text(), () => '')).includes(js); }
if (!live) die('deployed, but the live site is not serving the new build yet. Check it before posting. No Release was created.');
console.log(`   live at ${etTime(new Date())}`);
if (version) {
  gh('release', 'create', version, '--target', 'main', '--title', `${version} · ${f.name}`, '--notes', releaseNotes(f, now));
  step(`Release ${version} created`);
  const dir = ROOT + 'private/x-drafts';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${flag}.txt`, xDraft(f) + '\n');
  console.log(`\nX draft (saved to private/x-drafts/${flag}.txt, not posted):\n---\n${xDraft(f)}\n---`);
}
