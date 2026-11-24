import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runScenarios, outputHash, deriveSeed } from '../../engine/src/index';
import { baseInputs } from '../../engine/test/fixtures';

const bundle = readFileSync(new URL('./engine.bundle.js', import.meta.url), 'utf8');

const CASES = [
  { name: 'official-like', inputs: baseInputs(), paths: 20000 },
  { name: 'shocked', inputs: baseInputs({ newsIntensity: 0.9, tokenPremium: -0.04, shock: { drift: -0.15, jumpMult: 2.5, volMult: 1.6 } }), paths: 20000 },
  { name: 'touch-v2', inputs: baseInputs({ version: 2, levels: { backAbove: 33, giveBack: 26 } }), paths: 20000 },
];

for (const c of CASES) {
  test(`engine outputHash matches Node — ${c.name}`, async ({ page, browserName }) => {
    const seed = deriveSeed(c.inputs);
    const expected = outputHash(runScenarios(c.inputs, seed, { pathsPerModel: c.paths }));
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const got = await page.evaluate(
      ({ inputs, seed, paths }) => {
        const E = (window as any).QuintelEngine;
        return E.outputHash(E.runScenarios(inputs, seed, { pathsPerModel: paths }));
      },
      { inputs: c.inputs, seed, paths: c.paths },
    );
    console.log(`[${browserName}] ${c.name}: ${got}`);
    expect(got).toBe(expected);
  });
}
