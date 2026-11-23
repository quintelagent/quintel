/// <reference lib="webworker" />
import { runScenarios, outputHash, samplePaths, hashObject } from '@engine/index';
import type { EngineInputs } from '@engine/types';

type Msg =
  | { id: number; type: 'run'; inputs: EngineInputs; seed: string; pathsPerModel: number; withSample?: boolean }
  | { id: number; type: 'hash'; value: unknown }
  | { id: number; type: 'sample'; inputs: EngineInputs; seed: string; perModel: number };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.type === 'run') {
      const t0 = performance.now();
      const output = runScenarios(m.inputs, m.seed, {
        pathsPerModel: m.pathsPerModel,
        onProgress: (done, total) => (self as any).postMessage({ id: m.id, progress: done / total }),
      });
      const hash = outputHash(output);
      const ms = performance.now() - t0;
      const sample = m.withSample ? samplePaths(m.inputs, m.seed, 30) : null;
      (self as any).postMessage({ id: m.id, output, hash, inputHash: hashObject(m.inputs), ms, sample });
    } else if (m.type === 'sample') {
      (self as any).postMessage({ id: m.id, sample: samplePaths(m.inputs, m.seed, m.perModel) });
    } else if (m.type === 'hash') {
      (self as any).postMessage({ id: m.id, hash: hashObject(m.value) });
    }
  } catch (err) {
    (self as any).postMessage({ id: m.id, error: String((err as Error).message || err) });
  }
};
