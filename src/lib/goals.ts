import { exerciseProgress } from '@/lib/lifting';
import type { AppState, BodyGoal, ISODate, LiftGoal } from '@/types';

/**
 * Progress for a dated body or lift goal, read from data that already exists
 * elsewhere (logged body weight, logged sets) rather than a separate running
 * total — a goal is a target laid over real history, not its own ledger.
 */
export interface GoalProgress {
  current: number;
  /** 0-100, how far from start to target the current value sits. Clamped, so overshooting still reads as "done." */
  pct: number;
  /** null when the goal has no target date to pace against. */
  onTrack: boolean | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function paceCheck(startDate: ISODate, targetDate: ISODate | undefined, pct: number): boolean | null {
  if (!targetDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(targetDate).getTime();
  const now = Date.now();
  if (!(end > start)) return null;
  // 10-point grace so this doesn't flip day to day on ordinary weight noise.
  const elapsedPct = clamp(((now - start) / (end - start)) * 100, 0, 100);
  return pct >= elapsedPct - 10;
}

export function bodyGoalProgress(state: AppState, goal: BodyGoal): GoalProgress {
  const logs = state.health
    .filter((h) => h.bodyWeight != null && h.date >= goal.startDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const current = logs.length ? (logs[logs.length - 1].bodyWeight as number) : goal.startWeight;
  const span = goal.targetWeight - goal.startWeight;
  const pct = span === 0 ? 100 : clamp(((current - goal.startWeight) / span) * 100, 0, 100);
  return { current, pct, onTrack: paceCheck(goal.startDate, goal.targetDate, pct) };
}

export function liftGoalProgress(state: AppState, goal: LiftGoal): GoalProgress {
  const points = exerciseProgress(state, goal.exerciseName).filter((p) => p.date >= goal.startDate);
  const current = points.length ? points[points.length - 1].est1RM : goal.startWeight;
  const span = goal.targetWeight - goal.startWeight;
  const pct = span === 0 ? 100 : clamp(((current - goal.startWeight) / span) * 100, 0, 100);
  return { current, pct, onTrack: paceCheck(goal.startDate, goal.targetDate, pct) };
}

/** Body weight, oldest first, for a simple trend read. */
export function bodyWeightHistory(state: AppState, sinceDate?: ISODate): { date: ISODate; weight: number }[] {
  return state.health
    .filter((h) => h.bodyWeight != null && (!sinceDate || h.date >= sinceDate))
    .map((h) => ({ date: h.date, weight: h.bodyWeight as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
