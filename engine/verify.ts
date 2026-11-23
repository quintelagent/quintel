/**
 * CLI verifier: re-runs an official Quintel run locally and checks every hash.
 *   npx tsx engine/verify.ts <runId>
 *   QNTL_API=https://<host> npx tsx engine/verify.ts <runId>
 */
import { runScenarios, outputHash, deriveSeed, hashObject, type EngineInputs } from './src/index';

const API = process.env.QNTL_API || 'https://quintel.example';
const id = Number(process.argv[2]);
if (!id) {
  console.error('usage: npx tsx engine/verify.ts <runId>');
  process.exit(2);
}

const mark = (ok: boolean) => (ok ? '\x1b[32mmatch\x1b[0m' : '\x1b[31mNO MATCH\x1b[0m');

async function main() {
  const run = await fetch(`${API}/api/run/${id}`).then((r) => {
    if (!r.ok) throw new Error(`run ${id}: HTTP ${r.status}`);
    return r.json() as Promise<{ ts: string; seed: string; input_hash: string; output_hash: string; inputs: EngineInputs; output: { pathsPerModel: number } }>;
  });
  console.log(`Run #${id} · ${run.ts} · seed ${run.seed}`);
  let allOk = true;

  const ih = hashObject(run.inputs);
  console.log(`1. input hash   ${ih}  ${mark(ih === run.input_hash)}`);
  allOk &&= ih === run.input_hash;

  const seed = deriveSeed(run.inputs);
  console.log(`2. seed         ${seed}  ${mark(seed === run.seed)}`);
  allOk &&= seed === run.seed;

  const t0 = performance.now();
  const out = runScenarios(run.inputs, run.seed, { pathsPerModel: run.output.pathsPerModel });
  const oh = outputHash(out);
  console.log(`3. output hash  ${oh}  ${mark(oh === run.output_hash)}  (${out.totalPaths.toLocaleString()} paths, ${((performance.now() - t0) / 1000).toFixed(2)}s)`);
  allOk &&= oh === run.output_hash;

  const fp = await fetch(`${API}/api/fingerprint-for-run?id=${id}`).then((r) => r.json() as Promise<any>);
  if (!fp.payload) {
    console.log(`4. fingerprint  not yet written for hour ${fp.hour}`);
  } else {
    const fh = hashObject(fp.payload);
    const k = fp.payload.runIds.indexOf(id);
    const ok = fh === fp.hash && k >= 0 && fp.payload.outputHashes[k] === oh && fp.payload.inputHashes[k] === ih;
    console.log(`4. fingerprint  ${fh}  ${mark(ok)}  tx ${fp.tx ?? '(pending)'}`);
    console.log('   → on the explorer, the tx input data must equal the fingerprint hash above.');
    allOk &&= ok;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
