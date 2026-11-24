import type { SiteConfig } from './api';
import { closeMinute, prevTradingDay } from '../../../worker/src/session';
import { addDays, EARLY_CLOSES, etToUtc, HOLIDAYS } from './marketState';
import type { ToolTab } from './router';

export type EventType = 'closure' | 'half-day' | 'hearing';
/** `closure` is the ET date, which the Weekend gap tab names from the trading calendar */
export interface EventPreset { tab: ToolTab; closure?: string; whatIfId?: string }
export interface SiteEvent {
  id: string; type: EventType; label: string;
  /** ET calendar date */
  date: string;
  /** what the countdown runs to */
  start: Date;
  /** end of the event's ET day */
  end: Date;
  preset: EventPreset; url: string | null;
}

/** One line per event. A closure only shows if the trading calendar agrees with it. */
const CLOSURES: { id: string; type: 'closure' | 'half-day'; label: string; date: string }[] = [
  { id: 'thanksgiving', type: 'closure', label: 'Thanksgiving · market closed', date: '2026-11-26' },
  { id: 'half-day', type: 'half-day', label: 'Half day · market closes 1:00pm ET', date: '2026-11-27' },
];

const dayStart = (date: string) => etToUtc(date, 0, 0);
const closeOf = (date: string) => { const m = closeMinute(date); return etToUtc(date, Math.floor(m / 60), m % 60); };

/** Market closures: a full day counts down to the close before it, a half day to its early close. */
export const CLOSURE_EVENTS: SiteEvent[] = CLOSURES
  .filter((c) => (c.type === 'closure' ? HOLIDAYS : EARLY_CLOSES).has(c.date))
  .map((c) => ({
    ...c, url: null,
    start: closeOf(c.type === 'closure' ? prevTradingDay(c.date) : c.date),
    end: dayStart(addDays(c.date, 1)),
    preset: { tab: 'weekend', closure: c.date },
  }));

export function hearingEvent(h: SiteConfig['hearing']): SiteEvent | null {
  if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) return null;
  return {
    id: 'hearing', type: 'hearing', label: h.label, date: h.date,
    start: dayStart(h.date), end: dayStart(addDays(h.date, 1)),
    preset: { tab: 'whatif', whatIfId: 'hearing' },
    url: h.url && /^https?:\/\//.test(h.url) ? h.url : null,
  };
}

/** `started`: a closure that began at the previous close, before its own day. */
export type EventState = 'upcoming' | 'started' | 'today' | 'done' | 'hidden';
export function eventState(e: SiteEvent, now: Date): EventState {
  const t = now.getTime(), day = 86400000;
  if (t >= e.end.getTime() + day) return 'hidden';
  if (t >= e.end.getTime()) return 'done';
  if (t >= dayStart(e.date).getTime()) return 'today';
  return t >= e.start.getTime() ? 'started' : 'upcoming';
}

/** What to show now: next first, finished ones at the bottom, gone a day later. */
export function visibleEvents(config: SiteConfig | null, now: Date): { event: SiteEvent; state: EventState }[] {
  const hearing = hearingEvent(config?.hearing);
  return [...CLOSURE_EVENTS, ...(hearing ? [hearing] : [])]
    .map((event) => ({ event, state: eventState(event, now) }))
    .filter((x) => x.state !== 'hidden')
    .sort((a, b) => Number(a.state === 'done') - Number(b.state === 'done') || a.event.start.getTime() - b.event.start.getTime());
}
