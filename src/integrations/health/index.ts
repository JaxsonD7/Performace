import type { DataSource, HealthMetric, ISODate, SleepEntry } from '@/types';

/**
 * The seam for smartwatch and health imports.
 *
 * Nothing here talks to a network — this version is deliberately offline. What
 * it defines is the shape any importer must produce, so adding Apple Health,
 * Garmin, or Fitbit later is a matter of writing one parser and handing the
 * result to the store. No card, page, or chart has to change: an imported day
 * is just a `HealthMetric` record like any other.
 *
 * Apple Watch Ultra path, concretely:
 *   1. iPhone > Health > profile > Export All Health Data → export.zip
 *   2. Unzip, take `apple_health_export/export.xml`
 *   3. Feed it to `parseAppleHealthExport` and merge the result
 */
export interface HealthImportResult {
  metrics: HealthMetric[];
  sleep: SleepEntry[];
  /** Days the file covered, for the "imported N days" confirmation. */
  dates: ISODate[];
  source: DataSource;
}

export interface HealthImporter {
  /** Human name shown in Settings. */
  name: string;
  source: DataSource;
  /** File extensions the importer accepts, e.g. ['.xml', '.zip']. */
  accepts: string[];
  parse(file: File): Promise<HealthImportResult>;
}

/**
 * Apple Health XML holds one <Record> per sample. The real implementation walks
 * those records, buckets them by local day, and sums or averages per type:
 *
 *   HKQuantityTypeIdentifierStepCount            → steps (sum)
 *   HKQuantityTypeIdentifierActiveEnergyBurned   → activeCalories (sum)
 *   HKQuantityTypeIdentifierAppleExerciseTime    → exerciseMin (sum)
 *   HKQuantityTypeIdentifierRestingHeartRate     → restingHr (avg)
 *   HKQuantityTypeIdentifierHeartRateVariabilitySDNN → hrv (avg)
 *   HKQuantityTypeIdentifierVO2Max               → vo2max (latest)
 *   HKCategoryTypeIdentifierSleepAnalysis        → SleepEntry (asleep spans)
 */
export const appleHealthImporter: HealthImporter = {
  name: 'Apple Health (Apple Watch)',
  source: 'apple-health',
  accepts: ['.xml'],
  async parse() {
    throw new Error(
      'Apple Health import is not wired up yet. The parser belongs here — ' +
        'until then, add days by hand on the Health page.',
    );
  },
};

export const importers: HealthImporter[] = [appleHealthImporter];

/**
 * Merges imported days into existing ones without creating duplicates: an
 * imported day replaces a manual day for the same date, since the watch is the
 * better source for anything it measures.
 */
export function mergeHealth(existing: HealthMetric[], incoming: HealthMetric[]): HealthMetric[] {
  const byDate = new Map(existing.map((h) => [h.date, h]));
  incoming.forEach((h) => byDate.set(h.date, { ...byDate.get(h.date), ...h }));
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
