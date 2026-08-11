import { addDays, toMinutes } from '@/lib/date';
import type {
  AppState,
  Assignment,
  DayLog,
  Habit,
  HabitLog,
  HealthMetric,
  ISODate,
  Meal,
  Meeting,
  ReadingSession,
  ScheduleBlock,
  SleepEntry,
  Task,
  Workout,
} from '@/types';

/** Everything the Today dashboard needs for one date, derived in one pass. */
export interface DayData {
  date: ISODate;
  sleep?: SleepEntry;
  meals: Meal[];
  workouts: Workout[];
  reading: ReadingSession[];
  assignments: Assignment[];
  tasks: Task[];
  meetings: Meeting[];
  health?: HealthMetric;
  blocks: ScheduleBlock[];
  day: DayLog;
  improvementHabits: Habit[];
  orthodoxHabits: Habit[];
  habitLogs: Map<string, HabitLog>;
}

const byStart = <T extends { startTime: string }>(a: T, b: T) =>
  toMinutes(a.startTime) - toMinutes(b.startTime);

/**
 * A weekly meeting recurs on the same weekday from its start date onward, so a
 * club that meets Tuesdays shows up every Tuesday without duplicating records.
 */
export function meetingsOn(state: AppState, date: ISODate): Meeting[] {
  const target = new Date(date).getUTCDay();
  return state.meetings
    .filter((m) => {
      if (m.date === date) return true;
      if (m.repeat !== 'weekly') return false;
      if (m.date > date) return false;
      return new Date(m.date).getUTCDay() === target;
    })
    .sort(byStart);
}

export function selectDay(state: AppState, date: ISODate): DayData {
  const habits = state.habits.filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const logs = new Map<string, HabitLog>();
  state.habitLogs.forEach((l) => {
    if (l.date === date) logs.set(l.habitId, l);
  });

  return {
    date,
    sleep: state.sleep.find((s) => s.date === date),
    meals: state.meals.filter((m) => m.date === date),
    workouts: state.workouts.filter((w) => w.date === date),
    reading: state.reading.filter((r) => r.date === date),
    assignments: state.assignments.filter((a) => a.dueDate === date && a.status !== 'done'),
    tasks: state.tasks.filter((t) => t.date === date),
    meetings: meetingsOn(state, date),
    health: state.health.find((h) => h.date === date),
    blocks: state.blocks
      .filter((b) => b.date === date)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    day: state.days.find((d) => d.date === date) ?? { date, waterCups: 0 },
    improvementHabits: habits.filter((h) => h.group === 'improvement'),
    orthodoxHabits: habits.filter((h) => h.group === 'orthodox'),
    habitLogs: logs,
  };
}

export function isHabitDone(state: AppState, habitId: string, date: ISODate): boolean {
  return state.habitLogs.some((l) => l.habitId === habitId && l.date === date && l.done);
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function sumMacros(meals: Meal[]): Macros {
  return meals.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function readingMinutes(sessions: ReadingSession[]): number {
  return sessions.reduce((sum, r) => sum + r.minutes, 0);
}

/** Assignments that are open, ordered by how soon they hurt. */
export function openAssignments(state: AppState): Assignment[] {
  const weight = { high: 0, medium: 1, low: 2 };
  return state.assignments
    .filter((a) => a.status !== 'done')
    .sort((a, b) =>
      a.dueDate === b.dueDate
        ? weight[a.priority] - weight[b.priority]
        : a.dueDate < b.dueDate
          ? -1
          : 1,
    );
}

/** Anything unfinished and dated before today. */
export function overdueTasks(state: AppState, date: ISODate): Task[] {
  return state.tasks.filter((t) => !t.completed && t.date && t.date < date);
}

export function upcomingMeetings(state: AppState, from: ISODate, days: number): Meeting[] {
  const out: Meeting[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(from, i);
    meetingsOn(state, iso).forEach((m) => out.push({ ...m, date: iso }));
  }
  return out;
}

export function courseName(state: AppState, courseId?: string): string {
  return state.courses.find((c) => c.id === courseId)?.name ?? 'General';
}

export function courseSlot(state: AppState, courseId?: string): number {
  return state.courses.find((c) => c.id === courseId)?.colorSlot ?? 1;
}
