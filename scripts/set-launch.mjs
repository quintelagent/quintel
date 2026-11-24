#!/usr/bin/env node
// Fills the official token values everywhere from one place (launch.json).
//   node scripts/set-launch.mjs --ca 0x… [--pump <mint>] [--wallet 0x…] [--burn-tx 0x…] [--fee "1%"]
// Writes launch.json, wrangler.jsonc, README, DEPLOYMENTS and TRUST. The site, /token.json and the page head read launch.json when they build.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getAddress } from 'viem';

const ROOT = fileURLToPath(new URL('..', import.meta.url)), at = (p) => ROOT + p, read = (p) => readFileSync(at(p), 'utf8');
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i < 0 ? undefined : a[i + 1]; };
const die = (m) => { console.error('Stopped: ' + m); process.exit(1); };
const evm = (v, what) => { try { const c = getAddress(v); if (v !== c && v !== v.toLowerCase()) die(`${what}: the capital letters do not match its checksum. Copy it again.`); return c; } catch { return die(`${what} is not a valid address.`); } };
const L = JSON.parse(read('launch.json'));
if (opt('ca')) L.ca = evm(opt('ca'), 'the CA');
if (opt('wallet')) L.launchWallet = evm(opt('wallet'), 'the launch wallet');
if (opt('burn-tx')) { if (!/^0x[0-9a-fA-F]{64}$/.test(opt('burn-tx'))) die('the burn transaction is not a transaction hash.'); L.devBuyBurnTx = opt('burn-tx'); }
if (opt('pump')) { if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(opt('pump'))) die('the Pump.fun mint is not a Solana address.'); L.pumpMint = opt('pump'); }
if (opt('fee')) { if (!/^\d{1,2}(\.\d{1,2})?%$/.test(opt('fee'))) die('write the fee like 1% or 2.5%.'); L.creatorFee = opt('fee'); }
if (!L.ca) die('no CA yet. Pass --ca 0x…');
writeFileSync(at('launch.json'), JSON.stringify(L, null, 2) + '\n');

const EX = 'https://robinhoodchain.blockscout.com', pons = `https://ponsfamily.com/launchpad/${L.ca}`, pump = L.pumpMint && `https://pump.fun/coin/${L.pumpMint}`;
const rows = (file, map) => { // table rows are found by their first cell, so this can run again
  let s = read(file);
  for (const [cell, value] of Object.entries(map)) {
    if (!value) continue;
    const re = new RegExp(`^(\\| ${cell.replace(/[$()]/g, '\\$&')} \\| )[^|]*`, 'm');
    if (!re.test(s)) die(`row "${cell}" not found in ${file}`);
    s = s.replace(re, (_, head) => `${head}${value} `);
  }
  writeFileSync(at(file), s);
};
const token = `[\`${L.ca}\`](${EX}/token/${L.ca})`, wallet = L.launchWallet && `[\`${L.launchWallet}\`](${EX}/address/${L.launchWallet})`, burn = L.devBuyBurnTx && `[${L.devBuyBurnTx.slice(0, 10)}…](${EX}/tx/${L.devBuyBurnTx})`;
rows('README.md', { '$QNTL on Pons': token });
rows('DEPLOYMENTS.md', { '$QNTL contract (Pons)': token, '$QNTL page on Pons': `[ponsfamily.com](${pons})`, 'Launch wallet': wallet, 'Dev-buy burn transaction': burn, '$QNTL on Pump.fun': pump && `[\`${L.pumpMint}\`](${pump})` });
rows('TRUST.md', { 'Contract address': token, 'Launch wallet': wallet, 'Dev buy, and the burn of it': burn && `Burned in ${burn}`, 'Creator fee': L.creatorFee && `${L.creatorFee}. It pays for the engine, the data and the AI` });
writeFileSync(at('wrangler.jsonc'), read('wrangler.jsonc').replace(/"QNTL_TOKEN_PONS": "[^"]*"/, `"QNTL_TOKEN_PONS": "${L.ca}"`).replace(/"QNTL_TOKEN_SOLANA": "[^"]*"/, `"QNTL_TOKEN_SOLANA": "${L.pumpMint ?? ''}"`));
console.log(`CA ${L.ca}\nFilled: launch.json, wrangler.jsonc, README.md, DEPLOYMENTS.md, TRUST.md`);
