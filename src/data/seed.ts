import {
  DEFAULT_SETTINGS,
  defaultImprovementHabits,
  defaultOrthodoxHabits,
  defaultQuickActions,
} from '@/data/defaults';
import type { AppState } from '@/types';

export const STATE_VERSION = 8;

/**
 * The real starting state. The only defaults are the ones the brief asks for
 * by name — the daily improvement checklist and the Orthodox rule of life —
 * because those are the app's own habits, not sample data. Everything else
 * (tasks, meals, workouts, courses, meetings…) starts genuinely empty; there
 * is no fake two-week history to click through or delete.
 */
export function emptyState(): AppState {
  const habits = [...defaultImprovementHabits(), ...defaultOrthodoxHabits()];
  return {
    version: STATE_VERSION,
    // 0, not Date.now(): a brand new, never-edited state should always lose
    // a last-write-wins comparison against anything real pulled from sync.
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    habits,
    quickActions: defaultQuickActions(habits),
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
    mealPrepBatches: [],
    pantryItems: [],
    shoppingListItems: [],
    bodyGoals: [],
    liftGoals: [],
    gradeCategories: [],
    gradeEntries: [],
    dismissedMailIds: [],
    dismissedFinanceIds: [],
    dismissedPackageIds: [],
    dismissedDeadlineIds: [],
    autoScheduledDeadlineIds: [],
  };
}
