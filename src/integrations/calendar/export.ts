import { addDays, today } from '@/lib/date';
import type { AppState, ClockTime, ISODate } from '@/types';

/**
 * The export half of the calendar seam: meetings, class times, and
 * assignment due dates as a single `.ics` file you can import once into your
 * real calendar app. One-way and static — re-export after changes rather
 * than expecting a live feed, since a GitHub Pages site has no server to
 * host a subscribable one from.
 */

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function toIcsUtc(date: ISODate, time: ClockTime): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  return `${local.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function toIcsDateOnly(date: ISODate): string {
  return date.replace(/-/g, '');
}

/** The next date on/after `from` that falls on `weekday` — a class's first occurrence for RRULE. */
function nextOccurrence(from: ISODate, weekday: number): ISODate {
  const fromDate = new Date(from);
  const shift = (weekday - fromDate.getDay() + 7) % 7;
  return addDays(from, shift);
}

export function buildIcsExport(state: AppState): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Performace//EN', 'CALSCALE:GREGORIAN'];
  const stamp = toIcsUtc(today(), '00:00');
  const RRULE_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  const event = (fields: {
    uid: string;
    summary: string;
    dtstart: string;
    dtend?: string;
    location?: string;
    rrule?: string;
    allDay?: boolean;
  }) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${fields.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (fields.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${fields.dtstart}`);
    } else {
      lines.push(`DTSTART:${fields.dtstart}`);
      if (fields.dtend) lines.push(`DTEND:${fields.dtend}`);
    }
    lines.push(`SUMMARY:${escapeText(fields.summary)}`);
    if (fields.location) lines.push(`LOCATION:${escapeText(fields.location)}`);
    if (fields.rrule) lines.push(`RRULE:${fields.rrule}`);
    lines.push('END:VEVENT');
  };

  state.meetings.forEach((m) => {
    event({
      uid: `meeting-${m.id}@performace`,
      summary: m.title,
      dtstart: toIcsUtc(m.date, m.startTime),
      dtend: toIcsUtc(m.date, m.endTime),
      location: m.location,
      rrule: m.repeat === 'weekly' ? 'FREQ=WEEKLY' : undefined,
    });
  });

  state.courseMeetings.forEach((cm) => {
    const course = state.courses.find((c) => c.id === cm.courseId);
    const first = nextOccurrence(today(), cm.weekday);
    event({
      uid: `class-${cm.id}@performace`,
      summary: course ? `${course.name} class` : 'Class',
      dtstart: toIcsUtc(first, cm.startTime),
      dtend: toIcsUtc(first, cm.endTime),
      location: cm.location,
      rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAY[cm.weekday]}`,
    });
  });

  state.assignments
    .filter((a) => a.status !== 'done')
    .forEach((a) => {
      const course = state.courses.find((c) => c.id === a.courseId);
      event({
        uid: `assignment-${a.id}@performace`,
        summary: `Due: ${a.title}${course ? ` (${course.name})` : ''}`,
        dtstart: toIcsDateOnly(a.dueDate),
        allDay: true,
      });
    });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(state: AppState): void {
  const content = buildIcsExport(state);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performace-${today()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
