import { addDays, today, weekDates } from '@/lib/date';
import { meetingsOn } from '@/lib/selectors';
import type { AppState, Goal, Habit, ISODate } from '@/types';

/** Consecutive days ending today (or yesterday, if today is still open). */
export interface Streak {
  current: number;
  longest: number;
  /** Completions inside the current week, against the habit's weekly target. */
  weekDone: number;
  weekTarget: number;
}

export function habitStreak(state: AppState, habit: Habit, weekStart: ISODate): Streak {
  const done = new Set(
    state.habitLogs.filter((l) => l.habitId === habit.id && l.done).map((l) => l.date),
  );

  // Current streak: walk backwards from today. A day that has not happened yet
  // does not break a streak, so an untouched today is skipped rather than fatal.
  const t = today();
  let cursor = done.has(t) ? t : addDays(t, -1);
  let current = 0;
  while (done.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest streak: scan the sorted history for the longest consecutive run.
  const sorted = [...done].sort();
  let longest = 0;
  let run = 0;
  let prev: ISODate | null = null;
  sorted.forEach((d) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  });

  const weekDone = weekDates(weekStart).filter((d) => done.has(d)).length;
  return { current, longest, weekDone, weekTarget: habit.targetPerWeek };
}

export interface DayPoint {
  date: ISODate;
  value: number;
}

export interface WeekSummary {
  dates: ISODate[];
  sleepMinutes: DayPoint[];
  sleepAvgMin: number;
  workoutMinutes: DayPoint[];
  workoutsCompleted: number;
  workoutsPlanned: number;
  readingMinutes: DayPoint[];
  readingTotalMin: number;
  pagesRead: number;
  steps: DayPoint[];
  activeCalories: DayPoint[];
  waterCups: DayPoint[];
  /** Percent of all non-archived habits completed, per day. */
  habitCompletion: DayPoint[];
  orthodoxCompletion: DayPoint[];
  /** Estimated school minutes still owed on assignments due this week. */
  schoolLoadMin: number;
  schoolDueThisWeek: number;
  schoolDone: number;
  missedTasks: number;
  tasksCompleted: number;
  meetingsCount: number;
  cleanMealRate: number;
  avgCalories: number;
  avgProtein: number;
}

export function weekSummary(state: AppState, weekStart: ISODate): WeekSummary {
  const dates = weekDates(weekStart);
  const inWeek = (d: ISODate) => d >= dates[0] && d <= dates[6];

  const habits = state.habits.filter((h) => !h.archived);
  const orthodox = habits.filter((h) => h.group === 'orthodox');

  const doneKey = new Set(
    state.habitLogs.filter((l) => l.done).map((l) => `${l.habitId}|${l.date}`),
  );

  const sleepMinutes = dates.map((date) => ({
    date,
    value: state.sleep.find((s) => s.date === date)?.durationMin ?? 0,
  }));
  const sleptDays = sleepMinutes.filter((p) => p.value > 0);

  const workoutMinutes = dates.map((date) => ({
    date,
    value: state.workouts
      .filter((w) => w.date === date && w.status === 'completed')
      .reduce((sum, w) => sum + (w.actualMin ?? w.plannedMin), 0),
  }));

  const readingByDay = dates.map((date) => ({
    date,
    value: state.reading.filter((r) => r.date === date).reduce((sum, r) => sum + r.minutes, 0),
  }));

  const weekMeals = state.meals.filter((m) => inWeek(m.date));
  const mealDays = new Set(weekMeals.map((m) => m.date)).size || 1;

  const dueThisWeek = state.assignments.filter((a) => inWeek(a.dueDate));

  return {
    dates,
    sleepMinutes,
    sleepAvgMin: sleptDays.length
      ? Math.round(sleptDays.reduce((s, p) => s + p.value, 0) / sleptDays.length)
      : 0,
    workoutMinutes,
    workoutsCompleted: state.workouts.filter((w) => inWeek(w.date) && w.status === 'completed')
      .length,
    workoutsPlanned: state.workouts.filter((w) => inWeek(w.date)).length,
    readingMinutes: readingByDay,
    readingTotalMin: readingByDay.reduce((s, p) => s + p.value, 0),
    pagesRead: state.reading
      .filter((r) => inWeek(r.date))
      .reduce((s, r) => s + (r.pages ?? 0), 0),
    steps: dates.map((date) => ({
      date,
      value: state.health.find((h) => h.date === date)?.steps ?? 0,
    })),
    activeCalories: dates.map((date) => ({
      date,
      value: state.health.find((h) => h.date === date)?.activeCalories ?? 0,
    })),
    waterCups: dates.map((date) => ({
      date,
      value: state.days.find((d) => d.date === date)?.waterCups ?? 0,
    })),
    habitCompletion: dates.map((date) => ({
      date,
      value: habits.length
        ? Math.round(
            (habits.filter((h) => doneKey.has(`${h.id}|${date}`)).length / habits.length) * 100,
          )
        : 0,
    })),
    orthodoxCompletion: dates.map((date) => ({
      date,
      value: orthodox.length
        ? Math.round(
            (orthodox.filter((h) => doneKey.has(`${h.id}|${date}`)).length / orthodox.length) * 100,
          )
        : 0,
    })),
    schoolLoadMin: dueThisWeek
      .filter((a) => a.status !== 'done')
      .reduce((s, a) => s + Math.max(0, a.estimateMin - a.loggedMin), 0),
    schoolDueThisWeek: dueThisWeek.length,
    schoolDone: dueThisWeek.filter((a) => a.status === 'done').length,
    missedTasks: state.tasks.filter((t) => !t.completed && t.date && t.date < today()).length,
    tasksCompleted: state.tasks.filter((t) => t.completed && t.date && inWeek(t.date)).length,
    meetingsCount: dates.reduce((sum, d) => sum + meetingsOn(state, d).length, 0),
    cleanMealRate: weekMeals.length
      ? Math.round((weekMeals.filter((m) => m.clean).length / weekMeals.length) * 100)
      : 0,
    avgCalories: Math.round(
      weekMeals.reduce((s, m) => s + (m.calories ?? 0), 0) / mealDays,
    ),
    avgProtein: Math.round(weekMeals.reduce((s, m) => s + (m.protein ?? 0), 0) / mealDays),
  };
}

/**
 * Where a goal stands right now.
 *
 * A goal linked to a habit counts that habit's completions inside the current
 * period, so it can never disagree with the checklist. Unlinked goals use the
 * manual counter you bump from the Goals page.
 */
export function goalProgress(state: AppState, goal: Goal, weekStart: ISODate): number {
  if (!goal.linkedHabitId) return goal.current;

  const t = today();
  const from =
    goal.period === 'day'
      ? t
      : goal.period === 'week'
        ? weekStart
        : goal.period === 'month'
          ? `${t.slice(0, 7)}-01`
          : `${t.slice(0, 4)}-01-01`;

  return state.habitLogs.filter(
    (l) => l.habitId === goal.linkedHabitId && l.done && l.date >= from && l.date <= t,
  ).length;
}

/** Percent of the day's checklist that is done — the Today headline number. */
export function dayScore(state: AppState, date: ISODate): { done: number; total: number; pct: number } {
  const habits = state.habits.filter((h) => !h.archived);
  const done = habits.filter((h) =>
    state.habitLogs.some((l) => l.habitId === h.id && l.date === date && l.done),
  ).length;
  const total = habits.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
