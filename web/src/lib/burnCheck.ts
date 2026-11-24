import { hashObject } from '@engine/hash';
import { deriveSeed } from '@engine/run';
import { customInputs, type BurnRunView } from '../../../worker/src/burn/scenario';
import { api, type RunFull } from './api';
import { runInBrowser } from './engineClient';

/** Makes a custom run again here, starting from the official run it names. */
export async function recheck(id: number, onProgress: (p: number) => void): Promise<boolean> {
  const run = await api<BurnRunView>(`/api/burn/run/${id}`);
  const base = await api<RunFull>(`/api/run/${run.baseRunId}`);
  const inputs = customInputs(base.inputs, run.scenario);
  if (hashObject(base.inputs) !== base.input_hash || hashObject(inputs) !== run.inputHash || hashObject(run.inputs) !== run.inputHash || deriveSeed(inputs) !== run.seed) return false;
  return (await runInBrowser(inputs, run.seed, run.pathsPerModel, { onProgress })).hash === run.outputHash;
}
