import { parseIcs, type IcsParseResult } from '@/integrations/calendar/ics';
import type { Meeting } from '@/types';

/**
 * The seam for calendar import.
 *
 * A `.ics` file is a flat list of VEVENTs; each becomes a `Meeting`, which the
 * schedule generator already treats as a fixed commitment. That is the whole
 * integration — no new concepts, no new UI.
 */
export interface CalendarImporter {
  name: string;
  accepts: string[];
  parse(file: File): Promise<IcsParseResult>;
}

export const icsImporter: CalendarImporter = {
  name: 'Calendar file (.ics)',
  accepts: ['.ics'],
  async parse(file) {
    const text = await file.text();
    return parseIcs(text);
  },
};

/** Drops events already present, matching on title + date + start time. */
export function dedupeMeetings(existing: Meeting[], incoming: Meeting[]): Meeting[] {
  const key = (m: Meeting) => `${m.title}|${m.date}|${m.startTime}`;
  const seen = new Set(existing.map(key));
  return incoming.filter((m) => !seen.has(key(m)));
}
