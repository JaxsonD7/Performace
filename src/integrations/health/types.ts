import type { HealthMetric, ISODate, SleepEntry, Workout } from '@/types';

/**
 * What every importer produces, whatever it read.
 *
 * Parsers turn their own format into this; the merge step knows only this. So
 * adding Garmin or Fitbit later means writing a parser and nothing else.
 */
export interface HealthImport {
  metrics: HealthMetric[];
  sleep: SleepEntry[];
  workouts: Workout[];
  /** Every date the import touched, for the confirmation summary. */
  dates: ISODate[];
  /** Anything skipped or guessed at, shown to the user rather than swallowed. */
  warnings: string[];
}

export function emptyImport(): HealthImport {
  return { metrics: [], sleep: [], workouts: [], dates: [], warnings: [] };
}

/** How an import will change what is already stored. */
export interface ImportPlan {
  metricsNew: number;
  metricsUpdated: number;
  sleepNew: number;
  sleepUpdated: number;
  workoutsNew: number;
  workoutsSkipped: number;
  dateRange?: { from: ISODate; to: ISODate };
}

export type ImportProgress = (fraction: number, note?: string) => void;
