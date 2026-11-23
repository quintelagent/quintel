import type { EngineInputs, RunOutput } from '@engine/types';
import type { PathSample } from '@engine/sample';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (p: number) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const d = e.data;
      const p = pending.get(d.id);
      if (!p) return;
      if (d.progress !== undefined && d.output === undefined && d.hash === undefined && !d.error) { p.onProgress?.(d.progress); return; }
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error));
      else p.resolve(d);
    };
  }
  return worker;
}

export interface BrowserRun { output: RunOutput; hash: string; inputHash: string; ms: number; sample: PathSample | null }

export function runInBrowser(inputs: EngineInputs, seed: string, pathsPerModel: number, opts: { withSample?: boolean; onProgress?: (p: number) => void } = {}): Promise<BrowserRun> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts.onProgress });
    getWorker().postMessage({ id, type: 'run', inputs, seed, pathsPerModel, withSample: opts.withSample });
  });
}

export function hashInBrowser(value: unknown): Promise<string> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (d) => resolve(d.hash), reject });
    getWorker().postMessage({ id, type: 'hash', value });
  });
}

/** Daily-stepped paths from a run's own inputs + seed (same streams the server samples from). */
export function sampleInBrowser(inputs: EngineInputs, seed: string, perModel: number): Promise<PathSample> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (d) => resolve(d.sample), reject });
    getWorker().postMessage({ id, type: 'sample', inputs, seed, perModel });
  });
}
