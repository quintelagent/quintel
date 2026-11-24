import { useEffect, useState } from 'react';
import { navigate, type ToolTab } from './router';

/** Lets any section open the tool card on a tab with values set. */
export interface ToolPreset { tab: ToolTab; whatIfId?: string; closure?: string; n: number }
let current: ToolPreset | null = null;
let n = 0;
const subs = new Set<(p: ToolPreset) => void>();
export function openTool(tab: ToolTab, opts: { whatIfId?: string; closure?: string } = {}) {
  current = { tab, ...opts, n: ++n };
  subs.forEach((f) => f(current!));
  navigate('/#' + tab);
}
export function useToolPreset(): ToolPreset | null {
  const [p, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return p;
}
