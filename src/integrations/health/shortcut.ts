import { uid } from '@/lib/id';
import { toISODate } from '@/lib/date';
import { emptyImport, type HealthImport } from '@/integrations/health/types';
import type { HealthMetric, ISODate, SleepEntry } from '@/types';

/**
 * Reads a day (or several) from an iOS Shortcut, a pasted blob, or a URL.
 *
 * Deliberately forgiving. A Shortcut is assembled by hand on a phone, and the
 * exact field names people end up with vary — so every field accepts several
 * spellings, numbers may arrive with units attached ("8,412 steps"), and
 * anything unrecognised is reported rather than silently dropped. The import
 * screen shows exactly what was understood before anything is saved.
 */

const ALIASES: Record<string, string[]> = {
  date: ['date', 'day'],
  steps: ['steps', 'stepcount', 'stepCount'],
  activeCalories: ['activecalories', 'activeenergy', 'activeenergyburned', 'move', 'kcal'],
  exerciseMin: ['exercisemin', 'exercise', 'exerciseminutes', 'exercisetime'],
  standHours: ['standhours', 'stand', 'standhour'],
  restingHr: ['restinghr', 'restingheartrate', 'rhr'],
  hrv: ['hrv', 'heartratevariability', 'sdnn'],
  vo2max: ['vo2max', 'vo2'],
  respiratoryRate: ['respiratoryrate', 'respiration', 'breathing'],
  wristTempDelta: ['wristtemp', 'wristtemperature', 'temperature'],
  bodyWeight: ['bodyweight', 'weight', 'bodymass'],
  sleepMin: ['sleepmin', 'sleepminutes', 'sleep', 'timeasleep', 'asleep'],
  bedtime: ['bedtime', 'sleepstart', 'inbed'],
  wakeTime: ['waketime', 'wakeup', 'sleepend'],
};

/** Strips units, thousands separators, and stray text: "8,412 steps" -> 8412. */
function toNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!cleaned) return undefined;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** Accepts "22:41", "10:41 PM", or an ISO timestamp. */
function toClock(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const iso = raw.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const m = raw.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && h < 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function toDate(raw: unknown): ISODate | undefined {
  if (typeof raw !== 'string') return undefined;
  const direct = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : toISODate(parsed);
}

/** Finds a value under any of a field's accepted spellings. */
function pick(row: Record<string, unknown>, field: string): unknown {
  const wanted = ALIASES[field] ?? [field.toLowerCase()];
  for (const [key, value] of Object.entries(row)) {
    const norm = key.toLowerCase().replace(/[\s_-]/g, '');
    if (wanted.includes(norm)) {
      if (value === null || value === '' || value === 'null') return undefined;
      return value;
    }
  }
  return undefined;
}

function rowToRecords(
  row: Record<string, unknown>,
  warnings: string[],
): { metric?: HealthMetric; sleep?: SleepEntry } {
  const date = toDate(pick(row, 'date')) ?? toISODate(new Date());

  const metric: HealthMetric = { id: uid('health'), date, source: 'apple-watch' };
  const numeric: (keyof HealthMetric)[] = [
    'steps',
    'activeCalories',
    'exerciseMin',
    'standHours',
    'restingHr',
    'hrv',
    'vo2max',
    'respiratoryRate',
    'wristTempDelta',
    'bodyWeight',
  ];
  let filled = 0;
  numeric.forEach((field) => {
    const n = toNumber(pick(row, field));
    if (n !== undefined) {
      (metric[field] as number) = Math.round(n * 10) / 10;
      filled += 1;
    }
  });

  // Sleep needs a duration; the clock times are a bonus.
  const sleepMin = toNumber(pick(row, 'sleepMin'));
  let sleep: SleepEntry | undefined;
  if (sleepMin !== undefined && sleepMin > 0) {
    // A Shortcut that reports hours instead of minutes is a common slip.
    const minutes = sleepMin < 24 ? Math.round(sleepMin * 60) : Math.round(sleepMin);
    if (sleepMin < 24) {
      warnings.push(`Read sleep as ${sleepMin} hours (${minutes} min) — it looked like hours, not minutes.`);
    }
    sleep = {
      id: uid('sleep'),
      date,
      bedtime: toClock(pick(row, 'bedtime')) ?? '23:00',
      wakeTime: toClock(pick(row, 'wakeTime')) ?? '07:00',
      durationMin: minutes,
      quality: minutes >= 450 ? 4 : minutes >= 390 ? 3 : 2,
      source: 'apple-watch',
      notes: 'Imported from Shortcuts',
    };
  }

  if (!filled && !sleep) {
    warnings.push(`Nothing recognisable for ${date}. Check the field names in your Shortcut.`);
    return {};
  }
  return { metric: filled ? metric : undefined, sleep };
}

/** Parses a JSON object, a JSON array, or `key=value` pairs from a URL. */
export function parseShortcutPayload(input: string | Record<string, unknown>): HealthImport {
  const result = emptyImport();

  let rows: Record<string, unknown>[] = [];
  if (typeof input !== 'string') {
    rows = [input];
  } else {
    const text = input.trim();
    try {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Not JSON — treat it as a query string ("steps=8412&hrv=68").
      const params = new URLSearchParams(text.replace(/^[?#]+/, ''));
      const row: Record<string, unknown> = {};
      params.forEach((v, k) => (row[k] = v));
      if (![...params.keys()].length) {
        result.warnings.push('Could not read that — expected JSON or key=value pairs.');
        return result;
      }
      rows = [row];
    }
  }

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const { metric, sleep } = rowToRecords(row as Record<string, unknown>, result.warnings);
    if (metric) result.metrics.push(metric);
    if (sleep) result.sleep.push(sleep);
  });

  result.dates = [
    ...new Set([...result.metrics.map((m) => m.date), ...result.sleep.map((s) => s.date)]),
  ].sort();
  return result;
}

/**
 * Reads an import out of the current URL, for the Shortcut's "Open URL" step.
 * Supports both `?steps=…&hrv=…` and `?data=<json>`.
 */
export function parseImportUrl(search: string): HealthImport | null {
  const params = new URLSearchParams(search);
  const data = params.get('data');
  if (data) {
    try {
      return parseShortcutPayload(decodeURIComponent(data));
    } catch {
      return parseShortcutPayload(data);
    }
  }
  const known = [...params.keys()].filter((k) =>
    Object.values(ALIASES).some((list) => list.includes(k.toLowerCase().replace(/[\s_-]/g, ''))),
  );
  if (!known.length) return null;
  return parseShortcutPayload(search);
}

/** The example the in-app instructions show. */
export const SHORTCUT_EXAMPLE = {
  date: '2026-08-12',
  steps: 8412,
  activeCalories: 512,
  exerciseMin: 44,
  standHours: 11,
  restingHr: 54,
  hrv: 68,
  sleepMin: 447,
  bedtime: '22:41',
  wakeTime: '06:08',
};
