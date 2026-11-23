import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RunOutput } from '@engine/types';
import { api, useApi, type Latest, type SiteConfig } from './api';

interface Data { latest: Latest | null; output: RunOutput | null; config: SiteConfig | null; error: string | null }
const Ctx = createContext<Data>({ latest: null, output: null, config: null, error: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [latest, err] = useApi<Latest>('/api/latest', 30000);
  const [config] = useApi<SiteConfig>('/api/config');
  const [output, setOutput] = useState<RunOutput | null>(null);
  const runId = latest?.run?.id;
  useEffect(() => {
    if (!runId) return;
    api<{ id: number; output: RunOutput }>(`/api/output/${runId}`).then((d) => setOutput(d.output)).catch(() => {});
  }, [runId]);
  return <Ctx.Provider value={{ latest, output, config, error: err }}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
