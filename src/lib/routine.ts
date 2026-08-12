import { fromISODate } from '@/lib/date';
import type { DayRoutine, ISODate, Settings, Weekday } from '@/types';

/** The day's routine — settings.routines is keyed by weekday, always populated. */
export function routineFor(settings: Settings, weekday: Weekday): DayRoutine {
  return settings.routines[weekday];
}

export function routineOn(settings: Settings, date: ISODate): DayRoutine {
  return routineFor(settings, fromISODate(date).getDay() as Weekday);
}

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
