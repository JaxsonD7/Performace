import {
  DEFAULT_SETTINGS,
  defaultImprovementHabits,
  defaultOrthodoxHabits,
} from '@/data/defaults';
import type { AppState } from '@/types';

export const STATE_VERSION = 2;

/**
 * The real starting state. The only defaults are the ones the brief asks for
 * by name — the daily improvement checklist and the Orthodox rule of life —
 * because those are the app's own habits, not sample data. Everything else
 * (tasks, meals, workouts, courses, meetings…) starts genuinely empty; there
 * is no fake two-week history to click through or delete.
 */
export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    habits: [...defaultImprovementHabits(), ...defaultOrthodoxHabits()],
    habitLogs: [],
    meals: [],
    sleep: [],
    workouts: [],
    workoutTemplates: [],
    customExercises: [],
    books: [],
    reading: [],
    courses: [],
    courseMeetings: [],
    assignments: [],
    meetings: [],
    goals: [],
    health: [],
    blocks: [],
    days: [],
  };
}
