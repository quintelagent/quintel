import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script
import { addChangelog, clearOfRuns, listFlags, nextVersion, releaseNotes, setFlag, xDraft } from '../../scripts/ship-lib.mjs';
import { FEATURES } from '../src/features';

const src = readFileSync(new URL('../src/features.ts', import.meta.url), 'utf8');
const log = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
const d = new Date('2026-11-24T14:30:00Z');
describe('ship', () => {
  it('sees every flag in the registry', () => { expect(listFlags(src).map((f: any) => f.flag)).toEqual(FEATURES.filter((f) => f.flag).map((f) => f.flag)); });
  it('flips one flag only, and back', () => {
    for (const { flag } of listFlags(src)) {
      const on = setFlag(src, flag, true, d.toISOString());
      expect(listFlags(on).filter((f: any) => f.on).map((f: any) => f.flag)).toEqual([...listFlags(src).filter((f: any) => f.on).map((f: any) => f.flag), flag].sort((a, b) => FEATURES.findIndex((f) => f.flag === a) - FEATURES.findIndex((f) => f.flag === b)));
      expect(on.split('\n').filter((l, i) => l !== src.split('\n')[i])).toHaveLength(1);
      expect(on).toContain(`shippedAt: '${d.toISOString()}'`);
    }
    expect(setFlag(setFlag(src, 'SHIP_LOG', true, 'x'), 'SHIP_LOG', false, 'x')).toBe(src);
  });
  it('adds dated changelog entries without losing anything', () => {
    const f = listFlags(src)[0], once = addChangelog(log, f, true, d), twice = addChangelog(once, listFlags(src)[1], true, d);
    expect(once).toContain(`- **${f.name} is live** · 9:30am ET. ${f.oneLine}`);
    expect(twice.match(/## Tue, Nov 24, 2026/g)).toHaveLength(1);
    for (const l of log.split('\n')) expect(twice).toContain(l);
    expect(once.indexOf('## Tue, Nov 24, 2026')).toBeLessThan(once.indexOf('## Mon, Nov 23, 2026'));
  });
  it('numbers releases', () => { expect(nextVersion([])).toBe('v1.1'); expect(nextVersion(['v1.0', 'v1.2', 'v1.10', 'x'])).toBe('v1.11'); });
  it('writes neutral copy', () => { for (const f of listFlags(src)) { expect(releaseNotes(f, d)).toContain('Not financial advice.'); expect(xDraft(f)).toMatch(/^Now live: /); expect(xDraft(f).length).toBeLessThan(280); } });
  it('keeps clear of runs', () => { const at = (t: string) => clearOfRuns(new Date(`2026-11-24T14:${t}Z`)); expect([at('30:20'), at('31:29'), at('31:30'), at('35:00'), at('38:30'), at('38:31'), at('39:59')]).toEqual([false, false, true, true, true, false, false]); });
  it('every flag is off in production', () => { expect(FEATURES.filter((f) => f.flag && f.on)).toEqual([]); });
});
