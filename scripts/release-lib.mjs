/** Pure parts of `npm run release`, kept apart so they can be tested. */
export function listFlags(src) {
  return [...src.matchAll(/\{ id: '([\w-]+)', flag: '([A-Z_]+)', on: (true|false), name: '([^']+)', oneLine: '([^']+)'.*?route: '([^']+)'/g)]
    .map(([, id, flag, on, name, oneLine, route]) => ({ id, flag, on: on === 'true', name, oneLine, route }));
}
export function setFlag(src, flag, on, iso) {
  return src.split('\n').map((l) => {
    if (!l.includes(`flag: '${flag}'`)) return l;
    return l.replace(/on: (true|false)/, `on: ${on}`).replace(/status: '\w+'/, `status: '${on ? 'live' : 'planned'}'`).replace(/shippedAt: (null|'[^']*')/, `shippedAt: ${on ? `'${iso}'` : 'null'}`);
  }).join('\n');
}
const ET = { timeZone: 'America/New_York' };
export const etDate = (d) => new Intl.DateTimeFormat('en-CA', ET).format(d);
export const etTime = (d) => d.toLocaleTimeString('en-US', { ...ET, hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase() + ' ET';
/** new version section right under [Unreleased]; whatever waited there moves into it */
export function addChangelog(log, version, f, d) {
  const line = `- **${f.name}** · ${etTime(d)}. ${f.oneLine}`;
  const m = log.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## |$)/);
  if (!m) throw new Error('CHANGELOG.md has no [Unreleased] section');
  const waiting = m[1].trim();
  const added = waiting.startsWith('### Added') ? waiting.replace('### Added\n', `### Added\n${line}\n`) : `### Added\n${line}${waiting ? `\n\n${waiting}` : ''}`;
  return log.replace(m[0], `## [Unreleased]\n\n## [${version}] - ${etDate(d)}\n\n${added}\n`);
}
/** a row in README "Live today", before the last one */
export function addReadmeRow(md, f) {
  const row = `| **${f.name}** | ${f.oneLine} |`;
  if (md.includes(row)) return md;
  const last = '| **Status, docs, incidents** |';
  if (!md.includes(last)) throw new Error('README.md "Live today" table not found');
  return md.replace(last, `${row}\n${last}`);
}
/** app releases start at v0.2.0 and move the middle number */
export function nextVersion(tags, prefix = 'v', first = '0.2.0') {
  const v = tags.map((t) => t.match(new RegExp(`^${prefix}(\\d+)\\.(\\d+)\\.(\\d+)$`))).filter(Boolean).map((m) => [Number(m[1]), Number(m[2])]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).pop();
  return v ? `${v[0]}.${v[1] + 1}.0` : first;
}
const url = (f) => 'https://quintelagent.com' + (f.route === '/' ? '' : f.route);
export function releaseNotes(template, f, n) {
  return template.replace('{what}', n.what ?? `${f.name}. ${f.oneLine}`).replace('{why}', n.why ?? '').replace('{use}', n.use ?? `Open ${url(f)}`).replace('{verify}', n.verify ?? 'Open https://quintelagent.com/verify').replace('{media}', n.media ?? '').replace(/\n{3,}/g, '\n\n');
}
export const xDraft = (f, n = {}) => n.x ?? `Now live: ${f.name}.\n\n${f.oneLine}\n\n${url(f)}`;
const BAD = /\b(moon|10x|100x|buy|sell|pump(?!\.fun)|guarantee\w*|predict\w*|price target)\b/i;
export const badCopy = (s) => s.match(BAD)?.[0] ?? null;
/** runs start at :00, :10, :20… Deploy only between 1:30 and 8:30 past a ten-minute mark. */
export const clearOfRuns = (d) => { const s = (d.getUTCMinutes() % 10) * 60 + d.getUTCSeconds(); return s >= 90 && s <= 510; };
