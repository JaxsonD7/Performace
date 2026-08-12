import type { AppState, ExerciseSet, ISODate, WeightUnit, Workout } from '@/types';

/**
 * Everything about tracking lifts that isn't just CRUD: estimated one-rep max,
 * personal records, what you did last time, and plate math. All pure — the
 * workout log itself (`AppState.workouts`) is the only source of truth, so a
 * PR is always derived from real history rather than stored and allowed to
 * drift out of sync with it.
 */

/** Epley formula — the standard, simple estimated 1RM from a single set. */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export interface BestSet {
  date: ISODate;
  weight: number;
  reps: number;
  est1RM: number;
}

/**
 * The best completed set ever logged for an exercise name, by estimated 1RM.
 * `beforeDate` excludes a date and anything after it, so a workout being
 * edited right now can be compared against history without competing with
 * itself.
 */
export function personalBest(
  state: AppState,
  exerciseName: string,
  beforeDate?: ISODate,
): BestSet | undefined {
  const name = exerciseName.trim().toLowerCase();
  let best: BestSet | undefined;

  state.workouts.forEach((w) => {
    if (beforeDate && w.date >= beforeDate) return;
    w.exercises
      .filter((e) => e.name.trim().toLowerCase() === name)
      .forEach((e) => {
        e.sets.forEach((s) => {
          if (!s.done || !s.weight) return;
          const est = estimated1RM(s.weight, s.reps);
          if (!best || est > best.est1RM) {
            best = { date: w.date, weight: s.weight, reps: s.reps, est1RM: est };
          }
        });
      });
  });

  return best;
}

/** The most recent past session's completed sets for an exercise — what to beat today. */
export function lastPerformance(
  state: AppState,
  exerciseName: string,
  beforeDate: ISODate,
): { date: ISODate; sets: ExerciseSet[] } | undefined {
  const name = exerciseName.trim().toLowerCase();
  const past = state.workouts
    .filter((w) => w.date < beforeDate)
    .filter((w) => w.exercises.some((e) => e.name.trim().toLowerCase() === name))
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  const session = past[0];
  if (!session) return undefined;
  const exercise = session.exercises.find((e) => e.name.trim().toLowerCase() === name)!;
  return { date: session.date, sets: exercise.sets.filter((s) => s.done) };
}

/** A short "135×8, 135×8, 145×6" style summary for a set list. */
export function summarizeSets(sets: ExerciseSet[], unit: WeightUnit): string {
  if (!sets.length) return '—';
  return sets.map((s) => (s.weight ? `${s.weight}${unit}×${s.reps}` : `${s.reps} reps`)).join(', ');
}

/** True when this set beats the best set on record before `beforeDate`. */
export function isNewPR(
  state: AppState,
  exerciseName: string,
  set: ExerciseSet,
  beforeDate: ISODate,
): boolean {
  if (!set.done || !set.weight) return false;
  const best = personalBest(state, exerciseName, beforeDate);
  return estimated1RM(set.weight, set.reps) > (best?.est1RM ?? 0);
}

/**
 * Total volume (weight × reps, summed across completed sets) for one workout —
 * the simplest useful measure of how much work a session actually was.
 */
export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + (set.done ? (set.weight ?? 0) * set.reps : 0), 0),
    0,
  );
}

/** Best estimated-1RM per session for one exercise, oldest first — a progress line. */
export function exerciseProgress(
  state: AppState,
  exerciseName: string,
): { date: ISODate; est1RM: number; weight: number; reps: number }[] {
  const name = exerciseName.trim().toLowerCase();
  const points: { date: ISODate; est1RM: number; weight: number; reps: number }[] = [];

  state.workouts
    .filter((w) => w.exercises.some((e) => e.name.trim().toLowerCase() === name))
    .forEach((w) => {
      const exercise = w.exercises.find((e) => e.name.trim().toLowerCase() === name)!;
      let best: { weight: number; reps: number; est1RM: number } | undefined;
      exercise.sets.forEach((s) => {
        if (!s.done || !s.weight) return;
        const est = estimated1RM(s.weight, s.reps);
        if (!best || est > best.est1RM) best = { weight: s.weight, reps: s.reps, est1RM: est };
      });
      if (best) points.push({ date: w.date, ...best });
    });

  return points.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Every exercise name that has ever been logged, most-used first. */
export function loggedExerciseNames(state: AppState): string[] {
  const counts = new Map<string, number>();
  state.workouts.forEach((w) =>
    w.exercises.forEach((e) => {
      const name = e.name.trim();
      if (!name) return;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }),
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

// ---------------------------------------------------------------------------
// Plate math
// ---------------------------------------------------------------------------

const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateResult {
  perSide: number[];
  reachable: number;
  /** True when the target could not be hit exactly with available plates. */
  approximate: boolean;
}

/** Plates needed per side to load `target` total weight onto a bar. */
export function platesFor(target: number, barWeight: number, unit: WeightUnit): PlateResult {
  const set = unit === 'kg' ? PLATES_KG : PLATES_LB;
  let remaining = Math.max(0, target - barWeight) / 2;
  const perSide: number[] = [];

  for (const plate of set) {
    while (remaining + 1e-6 >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }

  const reachable = barWeight + perSide.reduce((s, p) => s + p, 0) * 2;
  return { perSide, reachable, approximate: Math.abs(reachable - target) > 0.01 };
}
