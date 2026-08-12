import type { HealthMetric } from '@/types';

/**
 * The health-import seam. Two working parsers live alongside this file:
 *
 *   `appleHealthXml.ts`  — streams an Apple Health `export.xml` for history
 *   `shortcut.ts`        — reads a daily JSON blob from an iOS Shortcut
 *
 * Both produce the same `HealthImport` shape (see `types.ts` in this folder),
 * which `HealthImportModal` merges into the store through `mergeHealth` below.
 * Adding Garmin or Fitbit later means writing one more parser that returns the
 * same shape — the modal, the merge step, and every card downstream stay
 * exactly as they are.
 */

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
