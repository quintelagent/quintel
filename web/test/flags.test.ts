import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FEATURES } from '../src/features';
import { workerFlag } from '../../worker/src/flags';

it('flags are off unless released, and production has no preview override', () => {
  for (const f of FEATURES) if (f.flag) { expect(workerFlag({}, f.flag)).toBe(f.on); expect(workerFlag({ PREVIEW_FLAGS: 'X,' + f.flag }, f.flag)).toBe(true); }
  expect(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')).not.toContain('PREVIEW_FLAGS');
});
