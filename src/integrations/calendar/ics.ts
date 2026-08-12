import { uid } from '@/lib/id';
import type { ClockTime, ISODate, Meeting } from '@/types';

/**
 * A small, forgiving .ics reader — enough for a personal calendar export, not
 * a full RFC 5545 implementation. Recurrence beyond plain weekly (RRULE
 * COUNT/UNTIL/BYDAY variations, daily/monthly rules, exceptions) collapses to
 * a single one-time occurrence on its first date rather than being silently
 * wrong; that matches `Meeting.repeat`, which only ever means "none" or
 * "weekly" in the first place.
 */
export interface IcsParseResult {
  meetings: Meeting[];
  warnings: string[];
}

/** Unfolds RFC 5545 line continuations (a leading space/tab means "same line as above"). */
function unfold(text: string): string[] {
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

/** Unescapes the handful of backslash escapes .ics text values use. */
function unescapeText(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

interface ParsedDateTime {
  date: ISODate;
  time: ClockTime;
  allDay: boolean;
}

/** DTSTART/DTEND value + params -> a local date and clock time, best-effort. */
function parseDateTime(prop: Prop): ParsedDateTime | null {
  const v = prop.value.trim();
  const isAllDay = prop.params.VALUE === 'DATE' || /^\d{8}$/.test(v);

  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;

  if (isAllDay || !h) {
    return { date: `${y}-${mo}-${d}`, time: '00:00', allDay: true };
  }

  if (z) {
    // UTC instant — convert to this browser's local time for display.
    const utc = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
    const date = `${utc.getFullYear()}-${String(utc.getMonth() + 1).padStart(2, '0')}-${String(utc.getDate()).padStart(2, '0')}`;
    const time = `${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`;
    return { date, time, allDay: false };
  }

  // A bare or TZID-qualified local time with no reliable IANA data available
  // client-side — treated as wall-clock time as written, which is right for
  // the overwhelmingly common case of exporting your own calendar.
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, allDay: false };
}

export function parseIcs(text: string): IcsParseResult {
  const lines = unfold(text);
  const meetings: Meeting[] = [];
  const warnings: string[] = [];

  let current: Record<string, Prop[]> | null = null;
  let skippedAllDay = 0;
  let skippedUnparsable = 0;

  for (const raw of lines) {
    const prop = parseLine(raw);
    if (!prop) continue;

    if (prop.name === 'BEGIN' && prop.value === 'VEVENT') {
      current = {};
      continue;
    }
    if (prop.name === 'END' && prop.value === 'VEVENT') {
      if (current) {
        const summary = current.SUMMARY?.[0];
        const dtstart = current.DTSTART?.[0];
        const dtend = current.DTEND?.[0];
        const location = current.LOCATION?.[0];
        const rrule = current.RRULE?.[0];

        if (!summary || !dtstart) {
          skippedUnparsable += 1;
        } else {
          const start = parseDateTime(dtstart);
          if (!start) {
            skippedUnparsable += 1;
          } else if (start.allDay) {
            skippedAllDay += 1;
          } else {
            const end = dtend ? parseDateTime(dtend) : null;
            const weekly = !!rrule && /FREQ=WEEKLY/i.test(rrule.value) && !/FREQ=(?!WEEKLY)/i.test(rrule.value);
            meetings.push({
              id: uid('meet'),
              title: unescapeText(summary.value) || 'Untitled event',
              kind: 'other',
              date: start.date,
              startTime: start.time,
              endTime: end && !end.allDay ? end.time : start.time,
              location: location ? unescapeText(location.value) : undefined,
              repeat: weekly ? 'weekly' : 'none',
            });
          }
        }
      }
      current = null;
      continue;
    }

    if (current) {
      current[prop.name] = [...(current[prop.name] ?? []), prop];
    }
  }

  if (skippedAllDay) {
    warnings.push(`${skippedAllDay} all-day event(s) skipped — this app's meetings need a start/end time.`);
  }
  if (skippedUnparsable) {
    warnings.push(`${skippedUnparsable} event(s) could not be read.`);
  }
  if (!meetings.length && !skippedAllDay && !skippedUnparsable) {
    warnings.push('No events found in that file.');
  }

  return { meetings, warnings };
}
