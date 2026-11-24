import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script
import { addChangelog, addReadmeRow, badCopy, clearOfRuns, listFlags, nextVersion, releaseNotes, setFlag, xDraft } from '../../scripts/release-lib.mjs';
import { FEATURES } from '../src/features';

const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const src = read('web/src/features.ts'), log = read('CHANGELOG.md'), readme = read('README.md'), d = new Date('2026-11-25T14:30:00Z');
describe('release', () => {
  it('sees every flag in the registry', () => { expect(listFlags(src).map((f: any) => f.flag)).toEqual(FEATURES.filter((f) => f.flag).map((f) => f.flag)); });
  it('flips one flag only, and back', () => {
    for (const { flag, on } of listFlags(src)) {
      if (on) continue;
      const next = setFlag(src, flag, true, d.toISOString());
      expect(next.split('\n').filter((l, i) => l !== src.split('\n')[i])).toHaveLength(1);
      expect(next).toContain(`shippedAt: '${d.toISOString()}'`);
      expect(setFlag(next, flag, false, 'x')).toBe(src);
    }
  });
  it('adds a dated changelog version and loses nothing', () => {
    const f = { name: 'Thing', oneLine: 'Does a thing.' }, once = addChangelog(log, '0.2.0', f, d), twice = addChangelog(once, '0.3.0', { ...f, name: 'Other' }, d);
    expect(once).toContain('## [0.2.0] - 2026-11-25\n\n### Added\n- **Thing** · 9:30am ET. Does a thing.');
    expect(twice.indexOf('[Unreleased]')).toBeLessThan(twice.indexOf('[0.3.0]')); expect(twice.indexOf('[0.3.0]')).toBeLessThan(twice.indexOf('[0.2.0]'));
    for (const l of log.split('\n')) expect(twice).toContain(l);
  });
  it('moves waiting notes into the version', () => {
    const t = addChangelog('# C\n\n## [Unreleased]\n### Fixed\n- a bug\n\n## [0.1.0] - 2026-11-24\n- x\n', '0.2.0', { name: 'N', oneLine: 'o.' }, d);
    expect(t).toMatch(/## \[0\.2\.0\][\s\S]*### Added\n- \*\*N\*\*[\s\S]*### Fixed\n- a bug[\s\S]*## \[0\.1\.0\]/);
  });
  it('adds one README row', () => { const f = { name: 'Thing', oneLine: 'Does a thing.' }, a = addReadmeRow(readme, f); expect(a).toContain('| **Thing** | Does a thing. |\n| **Status, docs, incidents** |'); expect(addReadmeRow(a, f)).toBe(a); });
  it('numbers releases', () => { expect(nextVersion([''])).toBe('0.2.0'); expect(nextVersion(['v0.2.0', 'v0.10.0', 'mcp-v0.4.0'])).toBe('0.11.0'); expect(nextVersion([], 'mcp-v', '0.1.0')).toBe('0.1.0'); });
  it('writes neutral copy', () => {
    for (const f of listFlags(src)) { const t = releaseNotes(read('.github/release-notes-template.md'), f, {}); expect(t).toContain('Not financial advice.'); expect(t).not.toMatch(/\{\w+\}/); expect(badCopy(xDraft(f))).toBe(null); }
    for (const b of ['to the moon', 'a 10x', 'buy it', 'we predict']) expect(badCopy(b)).not.toBe(null);
    expect(badCopy('Not affiliated with Nvidia, Robinhood, Pons or Pump.fun.')).toBe(null);
  });
  it('keeps clear of runs', () => { const at = (t: string) => clearOfRuns(new Date(`2026-11-24T14:${t}Z`)); expect([at('30:20'), at('31:29'), at('31:30'), at('35:00'), at('38:30'), at('38:31'), at('39:59')]).toEqual([false, false, true, true, true, false, false]); });
});
