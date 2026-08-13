import type { ClockTime, ISODate } from '@/types';

/**
 * All date handling is local-time and string-based. We never store a UTC
 * timestamp for a calendar day — "today" must mean the user's today, not the
 * server's, and a local-first app has no server to disagree with anyway.
 */

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

/** Parse "YYYY-MM-DD" as a local-midnight Date (never UTC). */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  const ms = fromISODate(a).getTime() - fromISODate(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function isToday(iso: ISODate): boolean {
  return iso === today();
}

export function startOfWeek(iso: ISODate, weekStartsOn: 0 | 1 = 0): ISODate {
  const d = fromISODate(iso);
  const shift = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(iso, -shift);
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatDate(
  iso: ISODate,
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' },
): string {
  return fromISODate(iso).toLocaleDateString(undefined, opts);
}

export function shortDay(iso: ISODate): string {
  return fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Today", "Tomorrow", "Yesterday", or a short date. */
export function relativeDay(iso: ISODate): string {
  const delta = diffDays(iso, today());
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta < 7) return formatDate(iso, { weekday: 'long' });
  return formatDate(iso, { month: 'short', day: 'numeric' });
}

/** "12m ago", "3h ago", "2d ago" — for a full datetime, not a calendar day. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(0, min)}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

// --- Clock time helpers ----------------------------------------------------

export function toMinutes(t: ClockTime): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(min: number): ClockTime {
  // Wrap so arithmetic that crosses midnight still yields a valid clock time.
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime(t: ClockTime): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h ?? 0, m ?? 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function nowClock(): ClockTime {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minutes between two clock times, treating an earlier end as crossing midnight. */
export function durationBetween(start: ClockTime, end: ClockTime): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return e >= s ? e - s : 1440 - s + e;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** Hours with one decimal, for sleep summaries: 462 -> "7.7". */
export function hours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}
