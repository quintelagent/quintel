import { BANNED_PATTERNS } from '../config';

/** Structural numbers allowed in any text (horizons, counts, thresholds). */
const STRUCTURAL = [1, 5, 10, 20, 21, 30, 50, 90, 95, 100, 200000, 1000000, 0];

/** Extract every numeric token from text (handles $1,234.56, 47%, -3.2, 1M, 200K). */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![A-Za-z0-9])[-−]?\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*([kKmM](?![a-z]))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let v = Number((m[1] + (m[2] || '')).replace(/,/g, ''));
    if (m[3]) v *= m[3].toLowerCase() === 'k' ? 1e3 : 1e6;
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** Collect all numbers from objects (deep), plus percent and rounded forms. */
export function allowedNumbers(...sources: unknown[]): number[] {
  const nums: number[] = [...STRUCTURAL];
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      nums.push(v, Math.abs(v));
      if (Math.abs(v) <= 1) nums.push(v * 100, Math.abs(v * 100)); // probabilities → %
    } else if (typeof v === 'string') {
      for (const n of extractNumbers(v)) nums.push(n);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return nums;
}

/** A number is OK if it matches an allowed number when rounded to 0, 1 or 2 decimals. */
export function numberAllowed(n: number, allowed: number[]): boolean {
  const a = Math.abs(n);
  for (const x of allowed) {
    const b = Math.abs(x);
    if (a === b) return true;
    for (const d of [0, 1, 2]) {
      const f = 10 ** d;
      if (Math.round(b * f) / f === a) return true;
    }
    if (b > 0 && Math.abs(a - b) / b < 0.0005) return true;
  }
  return false;
}

export interface GuardResult { ok: boolean; badNumbers: number[]; bannedHits: string[] }

export function guardText(text: string, allowed: number[]): GuardResult {
  const badNumbers = extractNumbers(text).filter((n) => !numberAllowed(n, allowed));
  const bannedHits: string[] = [];
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) bannedHits.push(m[0]);
  }
  return { ok: badNumbers.length === 0 && bannedHits.length === 0, badNumbers, bannedHits };
}

/** Flatten all text fields of a briefing for checking (excluding source URLs/dates). */
export function briefingText(b: { headline: string; whatChanged: string[]; scenarioSummary: string; keyRisks: string[]; watchNext: string[] }): string {
  return [b.headline, ...b.whatChanged, b.scenarioSummary, ...b.keyRisks, ...b.watchNext].join('\n');
}
