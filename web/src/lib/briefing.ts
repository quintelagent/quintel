import type { Briefing } from './api';
import { pts } from './format';
import { isIncidentRun } from './metrics';

/** Stored briefings are hashed and never edited. Old names and raw field names are shown with current wording. */
const MAP: [RegExp, string][] = [
  [/\bpAbovePre(?:Crisis|Drop)(?:Pct)?\b/g, 'odds of closing above the pre-drop level'],
  [/\bpUp(?:Pct|1[wm])?\b/g, 'odds of a rise'],
  [/\bpDown(10|20)(?:Pct)?\b/g, 'odds of a $1% fall'],
  [/\bvar95(?:Pct|_1m)?\b/g, '95% value at risk'],
  [/\bexp(?:ected)?MaxDrawdown(?:Pct|1m)?\b/g, 'expected max drawdown'],
  [/\bstressLevel\b/g, 'Stress Level'],
  [/\bcrisisLevel\b/g, 'Stress Level'],
  [/\bmodelAgreement\b/g, 'model agreement'],
  [/\bnewsIntensity\b/g, 'news intensity'],
  [/\bnextClose\b/g, 'next close'],
  [/\boneWeek\b/g, 'one week'],
  [/\boneMonth\b/g, 'one month'],
  [/\bp(5|25|75|95)\b/g, '$1th percentile'],
  [/\bp50\b/g, 'median'],
  [/\bcrisis levels?\b/gi, 'Stress Level'],
  [/\bcris[ei]s\b/g, 'stress'],
  [/\bCris[ei]s\b/g, 'Stress'],
  [/\bCRIS[EI]S\b/g, 'Stress'],
];
/** must run before the plain level rule, or "pre-" would be left in front of the new name */
const PRE: [RegExp, string][] = [
  [/\bpre[- ]crisis (levels?)\b/g, 'pre-drop $1'],
  [/\bPre[- ]crisis (levels?)\b/gi, 'Pre-drop $1'],
  [/\bpre[- ]crisis\b/g, 'pre-drop'],
  [/\bPre[- ]crisis\b/gi, 'Pre-drop'],
];

export interface Shown { text: string; changed: boolean }
export function displayText(stored: string | null | undefined): Shown {
  const raw = stored ?? '';
  let text = raw;
  for (const [re, to] of [...PRE, ...MAP]) text = text.replace(re, to);
  return { text, changed: text !== raw };
}

export interface ShownBriefing {
  headline: string; summary: string; whatChanged: string[]; keyRisks: string[]; watchNext: string[];
  sources: { title: string; url: string }[];
  /** any part uses current wording / a part shown on the card does */
  changed: boolean; cardChanged: boolean;
}
/** A third-party title is never reworded. One that uses the retired name, or has no title, is named by its site. */
function sourceTitle(title: string, url: string): string {
  if (title && !/cris[ei]s/i.test(title)) return title;
  try { return `Source on ${new URL(url).hostname.replace(/^www\./, '')}`; } catch { return 'Source'; }
}
const webUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);

export function displayBriefing(b: Briefing): ShownBriefing {
  const h = displayText(b.body.headline), s = displayText(b.body.scenarioSummary);
  let changed = h.changed || s.changed;
  const one = (t: string) => { const d = displayText(t); changed ||= d.changed; return d.text; };
  const list = (a: string[] | undefined) => (a ?? []).filter(Boolean).map(one);
  return {
    headline: h.text, summary: s.text,
    whatChanged: list(b.body.whatChanged), keyRisks: list(b.body.keyRisks), watchNext: list(b.body.watchNext),
    sources: (b.body.sources ?? []).filter((x) => webUrl(x.url)).map((x) => { const title = sourceTitle(x.title, x.url); changed ||= title !== x.title; return { title, url: x.url }; }),
    cardChanged: h.changed || s.changed, changed,
  };
}

/** How the text was made: code checks every number in AI text; a template only fills in numbers. */
export const checkLabel = (b: Briefing) => (b.fallback ? 'Template, numbers only' : 'Guard-checked');
export const checkNote = (b: Briefing) => (b.fallback
  ? 'Filled in from the run by a template. No AI text.'
  : 'Written by AI. Before it posted, code checked that every number came from the runs or the news, and blocked advice wording.');
/** big_move and big_news briefings post outside the schedule */
export const triggerLabel = (b: Briefing) => (b.body.trigger === 'big_move' ? 'Big move' : b.body.trigger === 'big_news' ? 'Big news' : null);
export const changeLabel = (c: number) => `Kept odds ${pts(c)}`;
export const incidentNote = (b: Pick<Briefing, 'run_id'>) => (isIncidentRun(b.run_id) ? `Run ${b.run_id} started from a stale price, so its odds were wrong. It is kept as published and can still be checked.` : null);

/** The archive list can trail the live list, so both are merged. Newest first. */
export function mergeBriefings(...lists: (Briefing[] | null)[]): Briefing[] | null {
  if (lists.every((l) => !l)) return null;
  const m = new Map<number, Briefing>();
  for (const l of lists) for (const b of l ?? []) m.set(b.id, b);
  return [...m.values()].sort((a, b) => b.id - a.id);
}
