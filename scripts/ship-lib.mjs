/** Pure parts of `npm run ship`, kept apart so they can be tested. */
export function listFlags(src) {
  return [...src.matchAll(/\{ id: '([\w-]+)', flag: '([A-Z_]+)', on: (true|false), name: '([^']+)', oneLine: '([^']+)'.*?route: '([^']+)'/g)]
    .map(([, id, flag, on, name, oneLine, route]) => ({ id, flag, on: on === 'true', name, oneLine, route }));
}
export function setFlag(src, flag, on, iso) {
  return src.split('\n').map((l) => {
    if (!l.includes(`flag: '${flag}'`)) return l;
    return l.replace(/on: (true|false)/, `on: ${on}`).replace(/status: '\w+'/, `status: '${on ? 'live' : 'soon'}'`).replace(/shippedAt: (null|'[^']*')/, `shippedAt: ${on ? `'${iso}'` : 'null'}`);
  }).join('\n');
}
const ET = { timeZone: 'America/New_York' };
export const etDay = (d) => d.toLocaleDateString('en-US', { ...ET, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
export const etTime = (d) => d.toLocaleTimeString('en-US', { ...ET, hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase() + ' ET';
/** newest day first, right under [Unreleased] when there is one */
export function addChangelog(log, f, on, d) {
  const head = `## ${etDay(d)}`, line = on ? `- **${f.name} is live** · ${etTime(d)}. ${f.oneLine}` : `- **${f.name} is turned off** · ${etTime(d)}.`;
  if (log.includes(head + '\n')) return log.replace(head + '\n', `${head}\n${line}\n`);
  const m = log.match(/\n## (?!\[Unreleased\])/);
  return m ? log.slice(0, m.index) + `\n${head}\n${line}\n` + log.slice(m.index) : log.trimEnd() + `\n\n${head}\n${line}\n`;
}
/** v1.1, v1.2, … (v1.0 is the launch) */
export function nextVersion(tags) {
  const n = tags.map((t) => t.match(/^v1\.(\d+)$/)).filter(Boolean).map((m) => Number(m[1]));
  return `v1.${Math.max(0, ...n) + 1}`;
}
const url = (f) => 'https://quintelagent.com' + (f.route === '/' ? '' : f.route);
export const DISCLAIMER = 'Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.';
export const releaseNotes = (f, d) => `**${f.name} is live.** ${f.oneLine}\n\nOpen it: ${url(f)}\n\nReleased ${etDay(d)}, ${etTime(d)}. What's next: https://quintelagent.com/status\n\n${DISCLAIMER}\n`;
export const xDraft = (f) => `Now live: ${f.name}.\n\n${f.oneLine}\n\n${url(f)}`;
/** runs start at :00, :10, :20… Deploy only between 1:30 and 8:30 past a ten-minute mark. */
export const clearOfRuns = (d) => { const s = (d.getUTCMinutes() % 10) * 60 + d.getUTCSeconds(); return s >= 90 && s <= 510; };
