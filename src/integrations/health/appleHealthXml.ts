import { uid } from '@/lib/id';
import { emptyImport, type HealthImport, type ImportProgress } from '@/integrations/health/types';
import type { HealthMetric, ISODate, SleepEntry, Workout, WorkoutType } from '@/types';

/**
 * Parses an Apple Health `export.xml` in the browser.
 *
 * The file is routinely hundreds of megabytes — years of heart-rate samples at
 * one row each — so it is streamed and scanned line by line rather than parsed
 * into a DOM. Only the record types below are kept; everything else is skipped
 * without allocating.
 *
 * Dates in the export look like "2026-08-11 07:10:00 -0500" and are already in
 * the local time the sample was recorded, so the first ten characters are the
 * calendar day. Reading them as text sidesteps timezone arithmetic entirely,
 * which is exactly what a per-day tracker wants.
 */

// --- What we keep ----------------------------------------------------------

type Agg = 'sum' | 'avg' | 'last' | 'max';

interface MetricSpec {
  field: keyof HealthMetric;
  agg: Agg;
  /** Convert the export's unit to the one the app stores. */
  scale?: (value: number, unit: string) => number;
}

const METRICS: Record<string, MetricSpec> = {
  HKQuantityTypeIdentifierStepCount: { field: 'steps', agg: 'sum' },
  HKQuantityTypeIdentifierActiveEnergyBurned: { field: 'activeCalories', agg: 'sum' },
  HKQuantityTypeIdentifierAppleExerciseTime: { field: 'exerciseMin', agg: 'sum' },
  HKQuantityTypeIdentifierRestingHeartRate: { field: 'restingHr', agg: 'avg' },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { field: 'hrv', agg: 'avg' },
  HKQuantityTypeIdentifierVO2Max: { field: 'vo2max', agg: 'last' },
  HKQuantityTypeIdentifierRespiratoryRate: { field: 'respiratoryRate', agg: 'avg' },
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: { field: 'wristTempDelta', agg: 'avg' },
  HKQuantityTypeIdentifierBodyMass: {
    field: 'bodyWeight',
    agg: 'last',
    // Apple exports whichever unit you use; the app stores pounds.
    scale: (v, unit) => (unit.startsWith('kg') ? v * 2.2046226 : v),
  },
};

/** Stand hours are a category sample; each "stood" hour counts as one. */
const STAND_TYPE = 'HKCategoryTypeIdentifierAppleStandHour';
const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';

/** Values that mean actually asleep, as opposed to in bed or awake. */
const ASLEEP = /AsleepCore|AsleepDeep|AsleepREM|AsleepUnspecified|SleepAnalysisAsleep$/;

const WORKOUT_TYPES: [RegExp, WorkoutType, string][] = [
  [/TraditionalStrengthTraining|FunctionalStrengthTraining/, 'full-body', 'Strength training'],
  [/Running/, 'cardio', 'Run'],
  [/Walking/, 'cardio', 'Walk'],
  [/Cycling/, 'cardio', 'Ride'],
  [/Swimming/, 'cardio', 'Swim'],
  [/HighIntensityIntervalTraining/, 'cardio', 'HIIT'],
  [/Rowing/, 'cardio', 'Row'],
  [/Elliptical|StairClimbing|Stairs/, 'cardio', 'Cardio'],
  [/Yoga|Flexibility|Pilates|Mind/, 'mobility', 'Mobility'],
  [/CoreTraining/, 'full-body', 'Core'],
  [/Basketball|Soccer|Football|Tennis|Hockey|Baseball|Volleyball|Golf|Climbing|Martial/, 'sport', 'Sport'],
];

// --- Small parsing helpers -------------------------------------------------

/** Pulls attributes out of an element's opening tag. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]] = m[2];
  return out;
}

const dayOf = (stamp: string): ISODate => stamp.slice(0, 10);
const clockOf = (stamp: string): string => stamp.slice(11, 16);

/** Minutes between two "YYYY-MM-DD HH:MM:SS ±HHMM" stamps. */
function minutesBetween(start: string, end: string): number {
  const toMs = (s: string) => Date.parse(s.slice(0, 19).replace(' ', 'T'));
  const ms = toMs(end) - toMs(start);
  return Number.isFinite(ms) ? Math.max(0, ms / 60000) : 0;
}

// --- Accumulators ----------------------------------------------------------

interface DayBucket {
  sums: Partial<Record<keyof HealthMetric, number>>;
  counts: Partial<Record<keyof HealthMetric, number>>;
  lasts: Partial<Record<keyof HealthMetric, number>>;
  standHours: number;
}

interface NightBucket {
  asleepMin: number;
  firstStart: string;
  lastEnd: string;
}

export interface AppleHealthOptions {
  /** Ignore anything before this date. Keeps a decade of history manageable. */
  since?: ISODate;
  onProgress?: ImportProgress;
}

export async function parseAppleHealthExport(
  file: File,
  options: AppleHealthOptions = {},
): Promise<HealthImport> {
  const { since, onProgress } = options;
  const result = emptyImport();

  const days = new Map<ISODate, DayBucket>();
  const nights = new Map<ISODate, NightBucket>();
  const workouts: Workout[] = [];

  const bucket = (date: ISODate): DayBucket => {
    let b = days.get(date);
    if (!b) {
      b = { sums: {}, counts: {}, lasts: {}, standHours: 0 };
      days.set(date, b);
    }
    return b;
  };

  let seenRecords = 0;
  let skippedFuture = 0;

  const handleRecord = (tag: string) => {
    const a = attrs(tag);
    const type = a.type;
    if (!type) return;
    const start = a.startDate;
    if (!start) return;
    const date = dayOf(start);
    if (since && date < since) return;
    seenRecords += 1;

    if (type === SLEEP_TYPE) {
      if (!ASLEEP.test(a.value ?? '')) return;
      const end = a.endDate ?? start;
      // A night belongs to the morning you woke on, which is the date the
      // sample ends — that is also how the app stores sleep.
      const wakeDate = dayOf(end);
      let n = nights.get(wakeDate);
      if (!n) {
        n = { asleepMin: 0, firstStart: start, lastEnd: end };
        nights.set(wakeDate, n);
      }
      n.asleepMin += minutesBetween(start, end);
      if (start < n.firstStart) n.firstStart = start;
      if (end > n.lastEnd) n.lastEnd = end;
      return;
    }

    if (type === STAND_TYPE) {
      // value is HKCategoryValueAppleStandHourStood / Idle
      if ((a.value ?? '').endsWith('Stood')) bucket(date).standHours += 1;
      return;
    }

    const spec = METRICS[type];
    if (!spec) return;
    const raw = Number(a.value);
    if (!Number.isFinite(raw)) return;
    const value = spec.scale ? spec.scale(raw, a.unit ?? '') : raw;
    const b = bucket(date);

    switch (spec.agg) {
      case 'sum':
        b.sums[spec.field] = (b.sums[spec.field] ?? 0) + value;
        break;
      case 'avg':
        b.sums[spec.field] = (b.sums[spec.field] ?? 0) + value;
        b.counts[spec.field] = (b.counts[spec.field] ?? 0) + 1;
        break;
      case 'max':
        b.lasts[spec.field] = Math.max(b.lasts[spec.field] ?? -Infinity, value);
        break;
      case 'last':
        b.lasts[spec.field] = value;
        break;
    }
  };

  const handleWorkout = (block: string) => {
    const a = attrs(block.slice(0, block.indexOf('>') + 1));
    const start = a.startDate;
    if (!start) return;
    const date = dayOf(start);
    if (since && date < since) return;

    const activity = a.workoutActivityType ?? '';
    const match = WORKOUT_TYPES.find(([re]) => re.test(activity));
    const type: WorkoutType = match ? match[1] : 'cardio';
    const title = match ? match[2] : activity.replace('HKWorkoutActivityType', '') || 'Workout';

    const duration = Number(a.duration);
    const minutes = Number.isFinite(duration)
      ? a.durationUnit === 'min' || !a.durationUnit
        ? duration
        : duration / 60
      : minutesBetween(start, a.endDate ?? start);

    // Newer exports move energy and heart rate into child <WorkoutStatistics>.
    let calories = Number(a.totalEnergyBurned);
    let avgHr: number | undefined;
    const statRe = /<WorkoutStatistics([^>]*)\/?>/g;
    let s: RegExpExecArray | null;
    while ((s = statRe.exec(block))) {
      const st = attrs(s[1]);
      if (st.type?.includes('ActiveEnergyBurned')) {
        const sum = Number(st.sum);
        if (Number.isFinite(sum)) calories = sum;
      }
      if (st.type?.includes('HeartRate')) {
        const avg = Number(st.average);
        if (Number.isFinite(avg)) avgHr = Math.round(avg);
      }
    }

    workouts.push({
      id: uid('wo'),
      date,
      title,
      type,
      status: 'completed',
      startTime: clockOf(start),
      plannedMin: Math.round(minutes),
      actualMin: Math.round(minutes),
      exercises: [],
      avgHr,
      activeCalories: Number.isFinite(calories) ? Math.round(calories) : undefined,
      notes: 'Imported from Apple Health',
    });
  };

  // --- Stream the file ------------------------------------------------------

  const total = file.size || 1;
  let processed = 0;
  let carry = '';
  let workoutBlock: string | null = null;

  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    processed += value.length;
    carry += value;

    // Keep the final partial line for the next chunk.
    const lastBreak = carry.lastIndexOf('\n');
    if (lastBreak === -1) continue;
    const chunk = carry.slice(0, lastBreak);
    carry = carry.slice(lastBreak + 1);

    for (const line of chunk.split('\n')) {
      if (workoutBlock !== null) {
        workoutBlock += line;
        if (line.includes('</Workout>')) {
          handleWorkout(workoutBlock);
          workoutBlock = null;
        }
        continue;
      }
      if (line.includes('<Record ')) {
        // A line can hold more than one record; take them all.
        const re = /<Record [^>]*>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) handleRecord(m[0]);
        continue;
      }
      if (line.includes('<Workout ')) {
        if (line.includes('</Workout>') || /\/>\s*$/.test(line)) handleWorkout(line);
        else workoutBlock = line;
      }
    }

    onProgress?.(Math.min(0.95, processed / total), `${seenRecords.toLocaleString()} samples read`);
  }
  if (carry.includes('<Record ')) {
    const re = /<Record [^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(carry))) handleRecord(m[0]);
  }

  onProgress?.(0.97, 'Summarising days');

  // --- Turn buckets into records -------------------------------------------

  const todayStr = new Date().toISOString().slice(0, 10);

  days.forEach((b, date) => {
    if (date > todayStr) {
      skippedFuture += 1;
      return;
    }
    const metric: HealthMetric = { id: uid('health'), date, source: 'apple-health' };
    (Object.keys(METRICS) as string[]).forEach((type) => {
      const spec = METRICS[type];
      const f = spec.field;
      if (spec.agg === 'sum' && b.sums[f] !== undefined) {
        (metric[f] as number) = Math.round(b.sums[f]!);
      } else if (spec.agg === 'avg' && b.counts[f]) {
        const avg = b.sums[f]! / b.counts[f]!;
        (metric[f] as number) = f === 'vo2max' || f === 'wristTempDelta' || f === 'respiratoryRate'
          ? Math.round(avg * 10) / 10
          : Math.round(avg);
      } else if ((spec.agg === 'last' || spec.agg === 'max') && b.lasts[f] !== undefined) {
        (metric[f] as number) = Math.round(b.lasts[f]! * 10) / 10;
      }
    });
    if (b.standHours) metric.standHours = b.standHours;

    // Skip days where nothing at all was recorded.
    const hasAny = Object.keys(metric).some((k) => !['id', 'date', 'source'].includes(k));
    if (hasAny) result.metrics.push(metric);
  });

  nights.forEach((n, date) => {
    // Under two hours is a nap, not a night — counting it would wreck the
    // sleep average and the "slept on time" streak.
    if (n.asleepMin < 120 || date > todayStr) return;
    const entry: SleepEntry = {
      id: uid('sleep'),
      date,
      bedtime: clockOf(n.firstStart),
      wakeTime: clockOf(n.lastEnd),
      durationMin: Math.round(n.asleepMin),
      quality: n.asleepMin >= 450 ? 4 : n.asleepMin >= 390 ? 3 : 2,
      source: 'apple-watch',
      notes: 'Imported from Apple Health',
    };
    result.sleep.push(entry);
  });

  result.workouts = workouts.filter((w) => w.date <= todayStr);

  if (!seenRecords) {
    result.warnings.push(
      'No health records found. Make sure you picked export.xml from the Apple Health export, not the zip file itself.',
    );
  }
  if (skippedFuture) {
    result.warnings.push(`Skipped ${skippedFuture} day(s) dated in the future.`);
  }
  result.warnings.push(
    'Sleep quality is estimated from how long you slept — Apple does not export a quality score.',
  );

  result.dates = [
    ...new Set([
      ...result.metrics.map((m) => m.date),
      ...result.sleep.map((s) => s.date),
      ...result.workouts.map((w) => w.date),
    ]),
  ].sort();

  onProgress?.(1, 'Done');
  return result;
}
