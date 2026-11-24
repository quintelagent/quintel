import type { EngineInputs, RunOutput } from '@engine/types';
import type { PathSample } from '@engine/sample';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (p: number) => void }>();

/** The worker itself broke (failed to load, crashed, out of memory): fail everything waiting, start fresh next time. */
function drop(w: Worker, message: string) {
  if (worker !== w) return;
  worker = null;
  w.terminate();
  const waiting = [...pending.values()];
  pending.clear();
  waiting.forEach((p) => p.reject(new Error(message)));
}

function getWorker(): Worker {
  if (!worker) {
    const w = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const d = e.data;
      const p = pending.get(d.id);
      if (!p) return;
      if (d.progress !== undefined && d.output === undefined && d.hash === undefined && !d.error) { p.onProgress?.(d.progress); return; }
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error));
      else p.resolve(d);
    };
    w.onerror = (e) => { e.preventDefault?.(); drop(w, e.message || 'The engine stopped'); };
    w.onmessageerror = () => drop(w, 'The engine reply could not be read');
    worker = w;
  }
  return worker;
}

function ask<T>(msg: Record<string, unknown>, pick: (d: any) => T, onProgress?: (p: number) => void): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (d) => resolve(pick(d)), reject, onProgress });
    try { getWorker().postMessage({ id, ...msg }); } catch (e) { pending.delete(id); reject(e instanceof Error ? e : new Error(String(e))); }
  });
}

export interface BrowserRun { output: RunOutput; hash: string; inputHash: string; ms: number; sample: PathSample | null }

export function runInBrowser(inputs: EngineInputs, seed: string, pathsPerModel: number, opts: { withSample?: boolean; onProgress?: (p: number) => void } = {}): Promise<BrowserRun> {
  return ask<BrowserRun>({ type: 'run', inputs, seed, pathsPerModel, withSample: opts.withSample }, (d) => d, opts.onProgress);
}

export function hashInBrowser(value: unknown): Promise<string> {
  return ask<string>({ type: 'hash', value }, (d) => d.hash);
}

/** Daily-stepped paths from a run's own inputs + seed (same streams the server samples from). */
export function sampleInBrowser(inputs: EngineInputs, seed: string, perModel: number): Promise<PathSample> {
  return ask<PathSample>({ type: 'sample', inputs, seed, perModel }, (d) => d.sample);
}
