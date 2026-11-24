import type { Env } from '../config';
import type { RunOutput } from '../../../engine/src/index';
import { chatJson, parseJsonLoose, capReached } from './openrouter';
import { allowedNumbers, briefingText, guardText } from './guards';

export interface Source { title: string; url: string; publishedAt: string }
export interface Briefing {
  headline: string;
  whatChanged: string[];
  scenarioSummary: string;
  keyRisks: string[];
  watchNext: string[];
  sources: Source[];
}

export interface NewsForBriefing { title: string; url: string; ts: string; oneLine: string; score: number; category: string }

const pct = (x: number) => Math.round(x * 1000) / 10;
/** prices in cents: what the model sees is what it may print */
const px = (x: number) => Math.round(x * 100) / 100;

/** Compact, briefing-relevant view of a run (the model sees only these numbers). */
export function runFacts(o: RunOutput | null) {
  if (!o) return null;
  const c = o.combined;
  // plain-language keys: the model copies key names into its text
  return {
    spot: px(o.spot),
    'Stress Level': o.crisis.level,
    'model agreement': o.agreement,
    'next close': { '5th percentile': px(c.horizons[0].pct.p5), median: px(c.horizons[0].pct.p50), '95th percentile': px(c.horizons[0].pct.p95), '% of scenarios higher': pct(c.probs[0].pUp) },
    'one week': { '5th percentile': px(c.horizons[1].pct.p5), median: px(c.horizons[1].pct.p50), '95th percentile': px(c.horizons[1].pct.p95), '% of scenarios higher': pct(c.probs[1].pUp), '% of scenarios down more than 10%': pct(c.probs[1].pDown10) },
    'one month': {
      '5th percentile': px(c.horizons[2].pct.p5), '25th percentile': px(c.horizons[2].pct.p25), median: px(c.horizons[2].pct.p50), '75th percentile': px(c.horizons[2].pct.p75), '95th percentile': px(c.horizons[2].pct.p95),
      '% of scenarios higher': pct(c.probs[2].pUp), '% of scenarios down more than 10%': pct(c.probs[2].pDown10), '% of scenarios down more than 20%': pct(c.probs[2].pDown20),
      '% of scenarios above the recent high': pct(c.probs[2].pAbovePreCrisis),
      'average worst fall inside the month, %': pct(c.expMaxDrawdown1m), '95% value at risk, %': pct(c.var95_1m),
    },
  };
}

const SYSTEM = `You are the research desk of Quintel, a public scenario engine for NVDA stock.
Write a short, sober briefing as JSON with exactly these keys:
{"headline": string (<= 90 chars), "whatChanged": string[] (2-4 bullets), "scenarioSummary": string (2-3 sentences), "keyRisks": string[] (2-4), "watchNext": string[] (2-3), "sources": [{"title","url","publishedAt"}]}
Hard rules:
- Use ONLY numbers that appear verbatim in CURRENT_RUN, PREVIOUS_RUN or the news items. Do not compute differences, do not invent figures, do not write dates or times.
- Call outputs "scenario odds" — never "prediction" or "forecast". Never give advice; never use the words buy, sell, guaranteed, fraud.
- Describe legal/regulatory matters only as reported ("reported SEC probe"). Nothing about anyone's personal life.
- Sources: only items from NEWS that you actually reference, copied exactly.
- Write prices as $ with two decimals and shares with a % sign. Say "scenario odds" or "share of scenarios", not "probability".
- Say "Stress Level" and "recent high". Never use the word crisis.
- Plain English, calm, precise. No emojis, no hype.`;

const usd = (x: number) => '$' + x.toFixed(2);

export function templatedBriefing(cur: RunOutput, news: NewsForBriefing[]): Briefing {
  const f = runFacts(cur)!;
  return {
    headline: `Stress Level ${f['Stress Level']} · ${f['one week']['% of scenarios higher']}% of scenarios end the week higher`,
    whatChanged: [
      `Latest run starts from ${usd(f.spot)} with model agreement at ${f['model agreement']}.`,
      `One-month middle 50% of scenarios: ${usd(f['one month']['25th percentile'])} to ${usd(f['one month']['75th percentile'])}.`,
    ],
    scenarioSummary: `Across 1,000,000 scenarios, the one-month median is ${usd(f['one month'].median)}. ${f['one month']['% of scenarios down more than 20%']}% of scenarios fall more than 20% within a month; ${f['one month']['% of scenarios higher']}% end the month higher.`,
    keyRisks: [
      `Tail: 5% of one-month scenarios end below ${usd(f['one month']['5th percentile'])}.`,
      `Expected worst drawdown inside the month: ${f['one month']['average worst fall inside the month, %']}%.`,
    ],
    watchNext: ['Whether model agreement holds on the next run.', 'Gap between the on-chain token and the stock.'],
    sources: news.slice(0, 3).map((n) => ({ title: n.title, url: n.url, publishedAt: n.ts })),
  };
}

function validShape(b: any): b is Briefing {
  return b && typeof b.headline === 'string' && Array.isArray(b.whatChanged) && typeof b.scenarioSummary === 'string'
    && Array.isArray(b.keyRisks) && Array.isArray(b.watchNext) && Array.isArray(b.sources);
}

export async function writeBriefing(env: Env, cur: RunOutput, prev: RunOutput | null, news: NewsForBriefing[]):
  Promise<{ briefing: Briefing; model: string; fallback: boolean; attempts: number; rejections: string[] }> {
  const curF = runFacts(cur);
  const prevF = runFacts(prev);
  const allowed = allowedNumbers(curF, prevF, news.map((n) => n.title + ' ' + n.oneLine));
  const rejections: string[] = [];
  if (env.OPENROUTER_API_KEY && !(await capReached(env))) {
    const user = `CURRENT_RUN: ${JSON.stringify(curF)}\nPREVIOUS_RUN: ${JSON.stringify(prevF)}\nNEWS: ${JSON.stringify(news.slice(0, 12))}`;
    // first attempt + max 2 retries
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const extra = rejections.length ? `\n\nYOUR LAST DRAFT WAS REJECTED: ${rejections[rejections.length - 1]}. Fix it.` : '';
        const r = await chatJson(env, 'briefing', env.BRIEFING_MODEL, SYSTEM, user + extra, 4000);
        const b = parseJsonLoose<Briefing>(r.text);
        if (!validShape(b)) { rejections.push('bad JSON shape'); continue; }
        const urls = new Set(news.map((n) => n.url));
        b.sources = b.sources.filter((s) => urls.has(s.url)).slice(0, 6);
        const g = guardText(briefingText(b), allowed);
        if (!g.ok) {
          rejections.push(`numbers not in run: [${g.badNumbers.join(', ')}]; banned: [${g.bannedHits.join(', ')}]`);
          continue;
        }
        return { briefing: b, model: env.BRIEFING_MODEL, fallback: false, attempts: attempt, rejections };
      } catch (e) {
        rejections.push((e as Error).message);
        if (/cap reached/.test((e as Error).message)) break;
      }
    }
  } else {
    rejections.push(env.OPENROUTER_API_KEY ? 'daily AI cap reached' : 'no AI key');
  }
  return { briefing: templatedBriefing(cur, news), model: 'template', fallback: true, attempts: rejections.length, rejections };
}
