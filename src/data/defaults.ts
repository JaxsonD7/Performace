import { uid } from '@/lib/id';
import type { DayRoutine, Habit, QuickAction, Settings, Weekday } from '@/types';

const now = () => new Date().toISOString();

/**
 * A reasonable starting rhythm. Every field is meant to be edited — the whole
 * point of per-day routines is that a Tuesday and a Saturday rarely look
 * alike, and this is just where a new day starts before you say otherwise.
 */
const WEEKDAY_ROUTINE: DayRoutine = {
  wakeTime: '06:30',
  bedTime: '22:30',
  breakfastTime: '07:15',
  lunchTime: '12:15',
  dinnerTime: '18:30',
  workoutTime: '16:00',
  readingTime: '20:30',
};

const WEEKEND_ROUTINE: DayRoutine = {
  wakeTime: '08:00',
  bedTime: '23:00',
  breakfastTime: '09:00',
  lunchTime: '13:00',
  dinnerTime: '18:30',
  workoutTime: '10:00',
  readingTime: '20:00',
};

export const DEFAULT_ROUTINES: Record<Weekday, DayRoutine> = {
  0: { ...WEEKEND_ROUTINE },
  1: { ...WEEKDAY_ROUTINE },
  2: { ...WEEKDAY_ROUTINE },
  3: { ...WEEKDAY_ROUTINE },
  4: { ...WEEKDAY_ROUTINE },
  5: { ...WEEKDAY_ROUTINE },
  6: { ...WEEKEND_ROUTINE },
};

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'system',
  weekStartsOn: 0,
  routines: DEFAULT_ROUTINES,
  focusBlockMin: 50,
  breakMin: 10,
  waterGoalOz: 64,
  readingGoalMin: 30,
  sleepGoalMin: 480,
  proteinGoal: 150,
  calorieGoal: 2400,
  stepGoal: 10000,
  workoutsPerWeekGoal: 5,
  healthDevice: 'apple-watch',
  weightUnit: 'lb',
  restTimerSec: 90,
  orthodoxCalendar: 'new',
};

/**
 * Six slots, matching the exact set asked for — water, a food photo, a
 * workout, body weight, and two open slots standing in for "whatever else".
 * Every slot is reconfigurable afterward from the dock's edit screen.
 */
export function defaultQuickActions(habits: Habit[]): QuickAction[] {
  const readHabit = habits.find((h) => h.name === 'Read');
  return [
    { id: uid('qa'), type: 'water', label: 'Water', icon: '💧', waterDelta: 8 },
    { id: uid('qa'), type: 'photo-meal', label: 'Food photo', icon: '📷' },
    { id: uid('qa'), type: 'workout-template', label: 'Workout', icon: '🏋️' },
    { id: uid('qa'), type: 'body-weight', label: 'Weight', icon: '⚖️' },
    { id: uid('qa'), type: 'quick-form', label: 'Task', icon: '✓', formTarget: 'task' },
    {
      id: uid('qa'),
      type: readHabit ? 'habit-toggle' : 'none',
      label: 'Read',
      icon: '📖',
      habitId: readHabit?.id,
    },
  ];
}

function habit(
  name: string,
  group: Habit['group'],
  icon: string,
  sortOrder: number,
  extra: Partial<Habit> = {},
): Habit {
  return {
    id: uid('habit'),
    name,
    group,
    icon,
    targetPerWeek: 7,
    archived: false,
    sortOrder,
    createdAt: now(),
    ...extra,
  };
}

/**
 * The daily improvement checklist, exactly the ten actions in the brief.
 * Anchored ones get a time so the schedule generator can place them.
 */
export function defaultImprovementHabits(): Habit[] {
  return [
    habit('Wake up on time', 'improvement', '☀️', 1, { anchorTime: '06:30', durationMin: 20 }),
    // No anchor time: the Orthodox "Prayer rule" practice owns that block on
    // the schedule, and two prayer blocks at the same time would be one too many.
    habit('Morning prayer', 'improvement', '🕯️', 2),
    habit('Read', 'improvement', '📖', 3),
    habit('Workout', 'improvement', '🏋️', 4, { targetPerWeek: 5 }),
    habit('Eat clean', 'improvement', '🥗', 5),
    habit('Drink water', 'improvement', '💧', 6),
    habit('Finish school work', 'improvement', '🎓', 7, { targetPerWeek: 5 }),
    habit('Attend meetings', 'improvement', '👥', 8, { targetPerWeek: 5 }),
    habit('Evening reflection', 'improvement', '🌙', 9, { anchorTime: '21:45', durationMin: 15 }),
    habit('Sleep on time', 'improvement', '🛏️', 10),
  ];
}

/**
 * The Orthodox rule of life from the brief. `targetPerWeek` here is a display
 * default only — actual fasting days are computed from the real liturgical
 * calendar (`src/lib/orthodoxCalendar.ts`), not hardcoded to Wednesday/Friday.
 */
export function defaultOrthodoxHabits(): Habit[] {
  return [
    habit('Prayer rule', 'orthodox', '📿', 1, {
      anchorTime: '06:45',
      durationMin: 20,
      notes: 'Morning and evening prayers from the prayer book.',
    }),
    habit('Scripture reading', 'orthodox', '✝️', 2, {
      durationMin: 15,
      notes: 'Daily Epistle and Gospel readings.',
    }),
    habit('Spiritual reading', 'orthodox', '📜', 3, {
      targetPerWeek: 5,
      notes: 'Church Fathers, lives of the saints.',
    }),
    habit('Fasting', 'orthodox', '🍞', 4, {
      targetPerWeek: 2,
      notes: 'Kept according to the Church calendar — see Today for what applies.',
    }),
    habit('Church attendance', 'orthodox', '⛪', 5, {
      targetPerWeek: 1,
      notes: 'Divine Liturgy, Vespers, feast days.',
    }),
    habit('Confession preparation', 'orthodox', '🙏', 6, {
      targetPerWeek: 1,
      notes: 'Examine conscience, prepare for confession.',
    }),
    habit('Gratitude', 'orthodox', '🌾', 7, { notes: 'Name three things to thank God for.' }),
    habit('Avoiding bad habits', 'orthodox', '🛡️', 8, {
      notes: 'Guard the eyes, the tongue, and the hours.',
    }),
    habit('Acts of service', 'orthodox', '🤲', 9, {
      targetPerWeek: 3,
      notes: 'Almsgiving, helping at home, helping a friend.',
    }),
  ];
}
