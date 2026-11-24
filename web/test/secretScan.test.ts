import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script
import { badPath, findings, okIdentity } from '../../scripts/secret-scan.mjs';

const j = (...p: string[]) => p.join(''); // built in pieces so this file never trips the scan itself
describe('secret scan', () => {
  it('catches secrets', () => {
    for (const s of [j('sk-or-v1-', 'a1b2c3d4'.repeat(8)), j('ghp_', 'A1b2'.repeat(9)), j('FINGERPRINT_', 'KEY=0x', 'ab'.repeat(32)), j('private', 'Key: "0x', '1f'.repeat(32), '"'), j('-----BEGIN EC PRIVATE', ' KEY-----'), j('ADMIN_', 'TOKEN = "', 'q8'.repeat(12), '"'), j('someone', '@gm', 'ail.com'), j('https://robinhood.g.alche', 'my.com/v2/', 'Zx9'.repeat(9))]) expect(findings(s), s.slice(0, 12)).not.toHaveLength(0);
  });
  it('leaves normal code alone', () => {
    for (const s of ['wallet 0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47', '"hash": "0x' + 'ab'.repeat(32) + '"', 'if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`)', 'OPENROUTER_API_KEY: string;', 'build@quintelagent.com', 'FINGERPRINT_KEY: generatePrivateKey()']) expect(findings(s), s).toHaveLength(0);
  });
  it('blocks private paths', () => {
    for (const p of ['private/LAUNCH_PLAN.md', 'QUINTEL_LAUNCH_PLAN.md', '.dev.vars', 'web/.env.local', 'keys/id_rsa']) expect(badPath(p), p).toBe(true);
    for (const p of ['docs/PROOF.md', 'web/src/features.ts', 'scripts/release.mjs']) expect(badPath(p), p).toBe(false);
  });
  it('only accepts Quintel', () => {
    expect(okIdentity('Quintel <build@quintelagent.com>')).toBe(true);
    expect(okIdentity('Quintel <123+quintel@users.noreply.github.com>')).toBe(true);
    expect(okIdentity('Somebody <x@y.com>')).toBe(false);
  });
});
