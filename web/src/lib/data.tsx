import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RunOutput } from '@engine/types';
import { api, useApi, type Briefing, type Desk, type Latest, type Proof, type RunRow, type SiteConfig } from './api';
import { useOnline } from './hooks';

interface Data {
  latest: Latest | null; latestError: boolean; reload: () => void;
  /** full output of the latest run (same id as `outputRunId`) */
  output: RunOutput | null; outputRunId: number | null; outputError: boolean; reloadOutput: () => void;
  config: SiteConfig | null; configError: boolean; reloadConfig: () => void;
  /** last 24h of runs, newest first */
  runs: RunRow[] | null; runsError: boolean;
  briefings: Briefing[] | null; briefingsError: boolean; reloadBriefings: () => void;
  proof: Proof | null; proofError: boolean; reloadProof: () => void;
  desk: Desk | null; deskError: boolean; reloadDesk: () => void;
  online: boolean;
}
const nop = () => {};
const none: Data = { latest: null, latestError: false, reload: nop, output: null, outputRunId: null, outputError: false, reloadOutput: nop, config: null, configError: false, reloadConfig: nop, runs: null, runsError: false, briefings: null, briefingsError: false, reloadBriefings: nop, proof: null, proofError: false, reloadProof: nop, desk: null, deskError: false, reloadDesk: nop, online: true };
const Ctx = createContext<Data>(none);

export function DataProvider({ children }: { children: ReactNode }) {
  const latest = useApi<Latest>('/api/latest', 30000);
  const config = useApi<SiteConfig>('/api/config');
  const runId = latest.data?.run?.id ?? null;
  const [runsTry, setRunsTry] = useState(0);
  // the since bound is rounded to the hour so the edge cache is shared between visitors
  const since = useMemo(() => (runId ? new Date(Math.floor(Date.now() / 3600000) * 3600000 - 24 * 3600000).toISOString() : null), [runId]);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [runsErr, setRunsErr] = useState(false);
  useEffect(() => {
    if (!since) return;
    let alive = true;
    api<RunRow[]>(`/api/runs?since=${encodeURIComponent(since)}&limit=200`).then((r) => { if (alive) { setRuns(r); setRunsErr(false); } }).catch(() => { if (alive) setRunsErr(true); });
    return () => { alive = false; };
  }, [since, runId, runsTry]);
  const briefings = useApi<Briefing[]>('/api/briefings?limit=20', 60000);
  const proof = useApi<Proof>('/api/proof', 60000);
  const desk = useApi<Desk>('/api/desk', 120000);
  const [out, setOut] = useState<{ id: number; output: RunOutput } | null>(null);
  const [outErr, setOutErr] = useState(false);
  // a failed run or output load tries again with the 30s poll
  useEffect(() => {
    if (!outErr && !runsErr) return;
    const t = window.setInterval(() => { if (document.hidden) return; if (outErr) setTry((n) => n + 1); if (runsErr) setRunsTry((n) => n + 1); }, 30000);
    return () => clearInterval(t);
  }, [outErr, runsErr]);
  const [tryN, setTry] = useState(0);
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    api<{ id: number; output: RunOutput }>(`/api/output/${runId}`).then((d) => { if (alive) { setOut(d); setOutErr(false); } }).catch(() => { if (alive) setOutErr(true); });
    return () => { alive = false; };
  }, [runId, tryN]);
  const online = useOnline();
  const value: Data = {
    latest: latest.data, latestError: latest.error, reload: latest.reload,
    output: out?.output ?? null, outputRunId: out?.id ?? null, outputError: outErr, reloadOutput: () => setTry((n) => n + 1),
    config: config.data, configError: config.error && !config.data, reloadConfig: config.reload, runs, runsError: runsErr,
    briefings: briefings.data, briefingsError: briefings.error, reloadBriefings: briefings.reload,
    proof: proof.data, proofError: proof.error, reloadProof: proof.reload,
    desk: desk.data, deskError: desk.error, reloadDesk: desk.reload,
    online,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useData = () => useContext(Ctx);
