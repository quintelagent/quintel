/** Whole calendar days (ET) until `date`; negative once it has passed. */
export function daysUntil(date: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
export const shortDate = (date: string) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
