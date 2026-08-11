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
  parse(file: File): Promise<Meeting[]>;
}

export const icsImporter: CalendarImporter = {
  name: 'Calendar file (.ics)',
  accepts: ['.ics'],
  async parse() {
    throw new Error('Calendar import is not wired up yet — add events by hand for now.');
  },
};

/** Drops events already present, matching on title + date + start time. */
export function dedupeMeetings(existing: Meeting[], incoming: Meeting[]): Meeting[] {
  const key = (m: Meeting) => `${m.title}|${m.date}|${m.startTime}`;
  const seen = new Set(existing.map(key));
  return incoming.filter((m) => !seen.has(key(m)));
}
