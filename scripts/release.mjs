#!/usr/bin/env node
// npm run release <feature>               release feature/<feature>
// npm run release <feature> -- --dry-run  every local step in a throwaway copy; nothing is pushed, deployed or released
//
// Order: merge main into the branch and test · push it, open the pull request, wait for CI · merge with a merge commit ·
// flag on, changelog, README, deploy between runs, smoke test · tag and GitHub Release · delete the remote branch · print an X draft.
// The merge is made here and pushed, so every commit on main is by Quintel. The X draft is printed and saved locally, never posted.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { addChangelog, addReadmeRow, badCopy, clearOfRuns, etTime, listFlags, nextVersion, releaseNotes, setFlag, xDraft } from './release-lib.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), feature = args.find((a) => !a.startsWith('--')), dry = args.includes('--dry-run');
let cwd = ROOT;
const run = (c, a, o = {}) => execFileSync(c, a, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...o });
const git = (...a) => run('git', a).trim();
const gh = (...a) => run('gh', a).trim();
const die = (m) => { console.error('\nStopped: ' + m); process.exit(1); };
const say = (n, m) => console.log(`${n}. ${m}`);
const would = (...c) => console.log('     would run: ' + c.join(' '));
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const tail = (e) => String(e.stdout || '').slice(-1200) + String(e.stderr || '').slice(-800);

const dir = ROOT + `private/releases/${feature}.json`;
if (!feature || !existsSync(dir)) die(`which feature? Ready: ${existsSync(ROOT + 'private/releases') ? readdirSync(ROOT + 'private/releases').map((x) => x.replace('.json', '')).join(', ') || 'none' : 'none'}`);
const n = JSON.parse(readFileSync(dir, 'utf8')); // { flag, title, what, why, use, verify, media, smoke: { path, text }, x, mcp, needs: [vars], secrets: [names] }
const prBody = ROOT + `private/prs/${feature}.md`, branch = `feature/${feature}`;
if (!existsSync(prBody)) die(`no pull request description at private/prs/${feature}.md`);

// ---- checks, before anything changes
if (git('branch', '--show-current') !== 'main') die('switch to main first.');
if (git('status', '--porcelain')) die('commit your changes first.');
if (git('config', 'user.name') !== 'Quintel') die('git user.name is not Quintel.');
run('node', ['scripts/secret-scan.mjs', '--all']);
git('fetch', '-q', '--tags', 'origin');
const localMain = git('rev-parse', 'main') === git('rev-parse', 'origin/main');
if (!localMain && !dry) die('main is not the same as origin/main.');
git('rev-parse', '--verify', branch);
const tags = git('tag', '-l').split('\n');
const version = nextVersion(tags), mcpVersion = n.mcp ? nextVersion(tags, 'mcp-v', '0.1.0') : null;
const now = new Date();
console.log(`\n${dry ? 'DRY RUN · ' : ''}Release ${n.title}  (${branch} -> main, v${version}${mcpVersion ? `, mcp-v${mcpVersion}` : ''})\n`);
for (const t of [n.what, n.why, n.use, n.x, readFileSync(prBody, 'utf8')]) if (t && badCopy(t)) die(`wording to fix before release: "${badCopy(t)}"`);
if (!dry && !args.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = (await rl.question('Type the feature name to go ahead: ')).trim() === feature; rl.close();
  if (!ok) die('not confirmed. Nothing changed.');
}

// ---- 1. merge main into the feature branch and test. Uses its own copy, so the main checkout stays put.
const held = git('worktree', 'list', '--porcelain').split('\n\n').find((w) => w.includes(`branch refs/heads/${branch}\n`) || w.endsWith(`branch refs/heads/${branch}`));
const work = dry ? ROOT + `private/wt/dry-${feature}` : held ? held.match(/^worktree (.+)$/m)[1] : ROOT + `private/wt/${feature}`;
const dryBranch = `dry-run/${feature}`;
const cleanup = () => { cwd = ROOT; if (!dry) return; try { run('git', ['worktree', 'remove', '--force', work]); } catch { /* gone */ } try { run('git', ['branch', '-D', dryBranch]); } catch { /* gone */ } };
if (dry) { cleanup(); rmSync(work, { recursive: true, force: true }); git('worktree', 'add', '-q', '-b', dryBranch, work, branch); }
else if (!held) git('worktree', 'add', '-q', work, branch);
if (!existsSync(work + '/node_modules')) symlinkSync(ROOT + 'node_modules', work + '/node_modules');
cwd = work;
if (git('status', '--porcelain')) { cleanup(); die(`${branch} has uncommitted changes.`); }
try {
  say(1, `merge main into ${branch} and test`);
  try { git('merge', '--no-edit', '-m', `Site: bring ${feature} up to date`, 'main'); } catch (e) { for (const c of run('git', ['diff', '--name-only', '--diff-filter=U']).trim().split('\n').filter(Boolean)) { const fix = ROOT + `private/resolutions/${feature}/${c}`; if (existsSync(fix)) { writeFileSync(work + '/' + c, readFileSync(fix)); run('git', ['add', c]); console.log(`     used the prepared merge of ${c}`); } }
    const left = run('git', ['diff', '--name-only', '--diff-filter=U']).trim(); if (!left && git('rev-parse', '-q', '--verify', 'MERGE_HEAD')) git('commit', '--no-edit'); else { const c = run('git', ['diff', '--name-only', '--diff-filter=U']).trim(); try { run('git', ['merge', '--abort']); } catch { /* none */ } throw new Error(`merge conflicts in:\n${c}`); } }
  for (const [c, ...a] of [['npm', 'run', 'typecheck'], ['npm', 'test'], ['npm', 'run', 'build'], ['node', 'scripts/secret-scan.mjs', '--all']]) { run(c, a); console.log(`     ok: ${[c, ...a].join(' ')}`); }
} catch (e) { cleanup(); die(`not ready to release.\n${e.stdout !== undefined ? tail(e) : e.message}`); }
// a feature can need values that only the owner has: nothing is pushed before they are set
const unset = (n.needs ?? []).filter((v) => !new RegExp(`"${v}"\\s*:\\s*"[^"]+"`).test(readFileSync(work + '/wrangler.jsonc', 'utf8')));
const noSecret = (n.secrets ?? []).filter((v) => !run('npx', ['wrangler', 'secret', 'list']).includes(`"${v}"`));
if (unset.length + noSecret.length) { const m = `not set yet: ${[...unset, ...noSecret].join(', ')}`; if (!dry) die(m); console.log('     ' + m + ' (a real release stops here)'); }
const migrations = git('diff', '--name-only', '--diff-filter=A', 'main', 'HEAD', '--', 'worker/migrations').split('\n').filter(Boolean);

// ---- 2. push, pull request, CI, merge
say(2, 'push the branch, open the pull request, wait for CI, merge');
let pr = 0;
if (dry) { would('git push origin', branch); would('gh pr create --base main --head', branch, '--title', JSON.stringify(n.title), '--body-file', `private/prs/${feature}.md`); would('gh pr checks --watch'); would('git merge --no-ff', branch, '&& git push origin main'); }
else {
  git('push', '-q', '-u', 'origin', branch);
  const url = gh('pr', 'create', '--base', 'main', '--head', branch, '--title', n.title, '--body-file', prBody);
  pr = Number(url.split('/').pop()); console.log('     ' + url);
  await wait(20);
  try { run('gh', ['pr', 'checks', String(pr), '--watch', '--interval', '15']); } catch (e) { die(`CI is not green on pull request ${pr}. Nothing was merged.\n${tail(e)}`); }
  console.log('     CI green');
  cwd = ROOT;
  git('pull', '-q', '--ff-only', 'origin', 'main');
  git('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr}: ${n.title}`, branch);
  git('push', '-q', 'origin', 'main');
  console.log('     merged');
}

// ---- 3 and 5. flag, changelog, README, /status, deploy, smoke test
say(3, `flag ${n.flag} on, changelog, README "Live today", /status, deploy, smoke test`);
const F = cwd + (cwd.endsWith('/') ? '' : '/') + 'web/src/features.ts', C = F.replace('web/src/features.ts', 'CHANGELOG.md'), M = F.replace('web/src/features.ts', 'README.md'), N = F.replace('web/src/features.ts', '.github/release-notes-template.md');
const f = listFlags(readFileSync(F, 'utf8')).find((x) => x.flag === n.flag);
if (!f || f.on) { cleanup(); die(f ? `${n.flag} is already on.` : `${n.flag} is not in features.ts.`); }
writeFileSync(F, setFlag(readFileSync(F, 'utf8'), n.flag, true, now.toISOString()));
writeFileSync(C, addChangelog(readFileSync(C, 'utf8'), version, f, now));
writeFileSync(M, addReadmeRow(readFileSync(M, 'utf8'), f));
const notes = releaseNotes(readFileSync(N, 'utf8'), f, n);
try { run('npm', ['run', 'typecheck']); run('npm', ['test']); run('npm', ['run', 'build']); console.log('     ok: checks with the flag on'); }
catch (e) { const t = tail(e); git('checkout', '--', '.'); cleanup(); die(`checks failed with the flag on. ${dry ? '' : 'The code is merged with its flag still off; nothing was deployed.'}\n${t}`); }
if (dry) {
  console.log(git('diff', '--stat').split('\n').map((l) => '     ' + l.trim()).join('\n'));
  would('git commit -m', `"Ship: ${f.name} is live"`, '&& git push origin main');
  if (migrations.length) would('wrangler d1 migrations apply quintel --remote', `(${migrations.join(', ')})`);
  would('wrangler deploy', '(between runs)'); would('smoke test', `https://quintelagent.com${n.smoke?.path ?? f.route}`, `shows "${n.smoke?.text ?? f.name}"`);
} else {
  git('add', 'web/src/features.ts', 'CHANGELOG.md', 'README.md'); git('commit', '-q', '-m', `Ship: ${f.name} is live`); git('push', '-q', 'origin', 'main');
  if (migrations.length) { run('npx', ['--no-install', 'wrangler', 'd1', 'migrations', 'apply', 'quintel', '--remote'], { env: { ...process.env, CI: '1' } }); console.log('     database migration applied'); }
  while (!clearOfRuns(new Date())) { console.log('     waiting for the run to finish'); await wait(20); }
  run('npx', ['--no-install', 'wrangler', 'deploy']);
  const js = readdirSync(ROOT + 'web/dist/assets').find((x) => /^index-.*\.js$/.test(x));
  let live = false;
  for (let i = 0; i < 24 && !live; i++) { await wait(5); live = (await fetch('https://quintelagent.com/', { cache: 'no-store' }).then((r) => r.text(), () => '')).includes(js); }
  if (!live) die('deployed, but the live site is not serving the new build yet. Check it. No tag or Release was made.');
  const out = run('node', ['scripts/smoke.mjs', n.smoke?.path ?? f.route, n.smoke?.text ?? f.name]);
  console.log('     live and checked: ' + out.trim());
}

// ---- 4. tag and Release
say(4, `tag v${version} and publish the GitHub Release`);
if (dry) { would(`git tag -a v${version}`, '&& git push origin', `v${version}`); would('gh release create', `v${version}`); if (mcpVersion) would('gh release create', `mcp-v${mcpVersion}`); console.log('\n     ---- notes\n' + notes.split('\n').map((l) => '     ' + l).join('\n')); }
else {
  const rel = (tag, title) => { git('tag', '-a', tag, '-m', title); git('push', '-q', 'origin', tag); gh('release', 'create', tag, '--verify-tag', '--title', title, '--notes', notes); console.log(`     ${tag}`); };
  rel(`v${version}`, `v${version} · ${f.name}`);
  if (mcpVersion) rel(`mcp-v${mcpVersion}`, `mcp-v${mcpVersion} · ${f.name}`);
}

// ---- 6 and 7
say(5, 'delete the merged remote branch');
if (dry) would('git push origin --delete', branch); else git('push', '-q', 'origin', '--delete', branch);
say(6, 'X draft (never posted)');
const x = xDraft(f, n);
console.log('\n---\n' + x + '\n---\n');
if (!dry) { mkdirSync(ROOT + 'private/x-drafts', { recursive: true }); writeFileSync(ROOT + `private/x-drafts/${feature}.txt`, x + '\n'); console.log(`Done at ${etTime(new Date())}.`); }
cleanup();
if (dry) console.log('Dry run finished. Nothing was pushed, deployed, tagged or released, and the throwaway branch is gone.');
