import { addDays, fromISODate, toISODate } from '@/lib/date';
import type { ISODate, OrthodoxCalendar } from '@/types';

/**
 * The Orthodox liturgical calendar: Pascha, the Twelve Great Feasts, and the
 * fasting periods that follow from them.
 *
 * Scope, deliberately: this covers Pascha and the Twelve Great Feasts, the
 * four multi-day fasts, and the weekly Wednesday/Friday fast with its
 * fast-free weeks. It does not attempt the full menaion of saints'
 * commemorations — that runs to thousands of entries and belongs in a proper
 * liturgical database, not a client-side date calculator. What is here is
 * exact, not approximate: the same Pascha algorithm parishes use to print
 * their own calendars.
 *
 * Every Orthodox jurisdiction uses the same Paschalion (the Julian-calendar
 * method below) for Pascha and everything that is dated relative to it. Only
 * the FIXED feasts and fasts differ: "new calendar" jurisdictions (OCA,
 * Antiochian, Greek Archdiocese, Ukrainian — most of the US) keep them on the
 * Gregorian date; "old calendar" jurisdictions (ROCOR, Serbian, Jerusalem,
 * Mt Athos) keep the whole year on the Julian calendar, currently 13 days
 * behind. `calendar` in every function below controls which.
 */

// ---------------------------------------------------------------------------
// Pascha
// ---------------------------------------------------------------------------

/**
 * Orthodox Pascha for a given (Gregorian civil) year, as a Gregorian date.
 *
 * Meeus's algorithm computes Easter in the Julian calendar, which is the
 * Paschalion every Orthodox jurisdiction uses; converting that Julian date to
 * its Gregorian equivalent is what puts it on the calendar your phone uses.
 * The Julian/Gregorian gap itself grows by a day roughly every 100–150 years
 * (13 days for the whole 1900–2099 span we actually care about here).
 */
export function paschaDate(year: number): ISODate {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const julianDay = ((d + e + 114) % 31) + 1;

  const gregorianOffset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  const julian = new Date(year, julianMonth - 1, julianDay);
  julian.setDate(julian.getDate() + gregorianOffset);
  return toISODate(julian);
}

// ---------------------------------------------------------------------------
// Movable feasts and fasts, relative to Pascha
// ---------------------------------------------------------------------------

export interface Feast {
  date: ISODate;
  name: string;
  /** Great feasts get a badge; lesser observances are shown only in lists. */
  great: boolean;
}

function movableFeasts(year: number): Feast[] {
  const pascha = paschaDate(year);
  const rel = (offset: number) => addDays(pascha, offset);
  return [
    { date: rel(-49), name: 'Cheesefare Sunday (Forgiveness Sunday)', great: false },
    { date: rel(-48), name: 'Clean Monday — Great Lent begins', great: false },
    { date: rel(-7), name: 'Palm Sunday', great: true },
    { date: rel(-2), name: 'Holy Friday', great: false },
    { date: rel(-1), name: 'Holy Saturday', great: false },
    { date: pascha, name: 'Pascha (Easter)', great: true },
    { date: rel(39), name: 'Ascension', great: true },
    { date: rel(49), name: 'Pentecost', great: true },
    { date: rel(56), name: 'All Saints Sunday', great: false },
  ];
}

/** The eight fixed-date Great Feasts, on the calendar this jurisdiction uses. */
function fixedGreatFeasts(year: number, calendar: OrthodoxCalendar): Feast[] {
  const shift = calendar === 'old' ? 13 : 0;
  const on = (month: number, day: number, name: string): Feast => {
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + shift);
    return { date: toISODate(d), name, great: true };
  };
  return [
    on(1, 6, 'Theophany'),
    on(2, 2, 'Presentation of Christ'),
    on(3, 25, 'Annunciation'),
    on(8, 6, 'Transfiguration'),
    on(8, 15, 'Dormition of the Theotokos'),
    on(9, 8, 'Nativity of the Theotokos'),
    on(9, 14, 'Elevation of the Holy Cross'),
    on(11, 21, 'Entrance of the Theotokos into the Temple'),
    on(12, 25, 'Nativity of Christ (Christmas)'),
  ];
}

/** Every feast in a calendar year, sorted. Spans two `paschaDate` calls since
 * Nativity/Theophany near year-end relate to the *next* year's Pascha cycle
 * for the movable feasts that matter (there are none that cross, in practice,
 * but computing both years keeps late-December and early-January correct). */
export function feastsForYear(year: number, calendar: OrthodoxCalendar): Feast[] {
  const feasts = [
    ...movableFeasts(year - 1).filter((f) => f.date.startsWith(String(year))),
    ...movableFeasts(year),
    ...movableFeasts(year + 1).filter((f) => f.date.startsWith(String(year))),
    ...fixedGreatFeasts(year, calendar),
  ];
  return feasts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The feast(s) falling on a specific date, if any. */
export function feastsOn(date: ISODate, calendar: OrthodoxCalendar): Feast[] {
  const year = Number(date.slice(0, 4));
  return feastsForYear(year, calendar).filter((f) => f.date === date);
}

/** The next upcoming Great Feast from a given date. */
export function nextGreatFeast(from: ISODate, calendar: OrthodoxCalendar): Feast | undefined {
  const year = Number(from.slice(0, 4));
  const upcoming = [
    ...feastsForYear(year, calendar),
    ...feastsForYear(year + 1, calendar),
  ].filter((f) => f.great && f.date > from);
  return upcoming.sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

// ---------------------------------------------------------------------------
// Fasting
// ---------------------------------------------------------------------------

export interface FastingStatus {
  fasting: boolean;
  /** Human label for why: the season, or "Wednesday fast", or undefined on an
   * ordinary day. */
  label?: string;
}

interface Range {
  start: ISODate;
  end: ISODate;
  name: string;
}

function inRange(date: ISODate, r: Range): boolean {
  return date >= r.start && date <= r.end;
}

/** The four multi-day fasting periods for a given year. */
function fastingPeriods(year: number, calendar: OrthodoxCalendar): Range[] {
  const pascha = paschaDate(year);
  const shift = calendar === 'old' ? 13 : 0;
  const on = (y: number, month: number, day: number): ISODate => {
    const d = new Date(y, month - 1, day);
    d.setDate(d.getDate() + shift);
    return toISODate(d);
  };

  const allSaints = addDays(pascha, 56);
  const apostlesStart = addDays(allSaints, 1); // Monday after All Saints Sunday
  const petersEve = on(year, 6, 28); // eve of Sts Peter & Paul

  return [
    { start: addDays(pascha, -48), end: addDays(pascha, -3), name: 'Great Lent' },
    { start: addDays(pascha, -2), end: addDays(pascha, -1), name: 'Holy Week' },
    // The Apostles' Fast can be a few days or several weeks depending on when
    // Pascha falls; if All Saints Sunday is after the fast's fixed end, there
    // simply is no fast that year (this does happen).
    ...(apostlesStart <= petersEve
      ? [{ start: apostlesStart, end: petersEve, name: "Apostles' Fast" }]
      : []),
    { start: on(year, 8, 1), end: on(year, 8, 14), name: 'Dormition Fast' },
    { start: on(year, 11, 15), end: on(year, 12, 24), name: 'Nativity Fast' },
  ];
}

/** Weeks with no fasting at all, even on Wednesday/Friday. */
function fastFreeWeeks(year: number, calendar: OrthodoxCalendar): Range[] {
  const pascha = paschaDate(year);
  const shift = calendar === 'old' ? 13 : 0;
  const on = (y: number, month: number, day: number): ISODate => {
    const d = new Date(y, month - 1, day);
    d.setDate(d.getDate() + shift);
    return toISODate(d);
  };
  return [
    { start: addDays(pascha, -70), end: addDays(pascha, -64), name: 'Publican & Pharisee' },
    { start: addDays(pascha, -42), end: addDays(pascha, -36), name: 'Cheesefare week' },
    { start: pascha, end: addDays(pascha, 7), name: 'Bright Week' },
    { start: addDays(pascha, 49), end: addDays(pascha, 56), name: 'Trinity Week' },
    { start: on(year, 12, 25), end: on(year + 1, 1, 4), name: 'Nativity — Theophany' },
  ];
}

/**
 * Whether a date is a fasting day, and why. Feasts that fall on a Wednesday
 * or Friday lift that day's fast; the four fasting periods and the weekly
 * fast otherwise stand on their own.
 */
export function fastingStatus(date: ISODate, calendar: OrthodoxCalendar): FastingStatus {
  const year = Number(date.slice(0, 4));
  const freeWeeks = [
    ...fastFreeWeeks(year - 1, calendar),
    ...fastFreeWeeks(year, calendar),
    ...fastFreeWeeks(year + 1, calendar),
  ];
  if (freeWeeks.some((r) => inRange(date, r))) return { fasting: false };

  if (feastsOn(date, calendar).some((f) => f.great)) return { fasting: false };

  const periods = [
    ...fastingPeriods(year - 1, calendar),
    ...fastingPeriods(year, calendar),
    ...fastingPeriods(year + 1, calendar),
  ];
  const period = periods.find((r) => inRange(date, r));
  if (period) return { fasting: true, label: period.name };

  const dow = fromISODate(date).getDay();
  if (dow === 3) return { fasting: true, label: 'Wednesday fast' };
  if (dow === 5) return { fasting: true, label: 'Friday fast' };

  return { fasting: false };
}

/** How many of the last 7 days (inclusive) were fasting days — for the
 * Fasting habit's weekly target, computed rather than hardcoded. */
export function fastDaysInWeek(weekDates: ISODate[], calendar: OrthodoxCalendar): number {
  return weekDates.filter((d) => fastingStatus(d, calendar).fasting).length;
}
