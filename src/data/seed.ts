import { addDays, fromISODate, today, toMinutes } from '@/lib/date';
import { uid } from '@/lib/id';
import {
  DEFAULT_SETTINGS,
  defaultImprovementHabits,
  defaultOrthodoxHabits,
} from '@/data/defaults';
import type {
  AppState,
  Assignment,
  Book,
  Course,
  DayLog,
  Goal,
  HealthMetric,
  Habit,
  HabitLog,
  ISODate,
  Meal,
  Meeting,
  ReadingSession,
  SleepEntry,
  Task,
  Workout,
} from '@/types';

export const STATE_VERSION = 1;

const nowISO = () => new Date().toISOString();

/** Deterministic pseudo-random so the sample week looks varied but stable. */
function wobble(seed: number, spread: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * spread;
}

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
    books: [],
    reading: [],
    courses: [],
    assignments: [],
    meetings: [],
    goals: [],
    health: [],
    blocks: [],
    days: [],
  };
}

/**
 * A full worked example: two weeks of history plus a live today, so every
 * dashboard card, streak, and trend chart has something real to show on first
 * launch. Settings > Data > "Reset to sample data" rebuilds this.
 */
export function seedState(): AppState {
  const t = today();
  const habits: Habit[] = [...defaultImprovementHabits(), ...defaultOrthodoxHabits()];
  const byName = (n: string) => habits.find((h) => h.name === n)!;

  // --- Courses & school ----------------------------------------------------
  const courses: Course[] = [
    { id: uid('course'), name: 'Calculus II', code: 'MATH 152', colorSlot: 1 },
    { id: uid('course'), name: 'World History', code: 'HIST 201', colorSlot: 2 },
    { id: uid('course'), name: 'Chemistry', code: 'CHEM 110', colorSlot: 3 },
    { id: uid('course'), name: 'English Literature', code: 'ENGL 130', colorSlot: 7 },
  ];
  const [calc, hist, chem, engl] = courses;

  const assignments: Assignment[] = [
    {
      id: uid('asg'),
      courseId: calc.id,
      title: 'Problem set 7 — integration by parts',
      type: 'homework',
      dueDate: addDays(t, 1),
      estimateMin: 90,
      status: 'in-progress',
      priority: 'high',
      loggedMin: 30,
      createdAt: nowISO(),
    },
    {
      id: uid('asg'),
      courseId: hist.id,
      title: 'Read ch. 12 — the Byzantine Empire',
      type: 'reading',
      dueDate: t,
      estimateMin: 45,
      status: 'not-started',
      priority: 'medium',
      loggedMin: 0,
      createdAt: nowISO(),
    },
    {
      id: uid('asg'),
      courseId: chem.id,
      title: 'Lab report — titration',
      type: 'project',
      dueDate: addDays(t, 3),
      estimateMin: 120,
      status: 'not-started',
      priority: 'high',
      loggedMin: 0,
      createdAt: nowISO(),
    },
    {
      id: uid('asg'),
      courseId: engl.id,
      title: 'Essay draft — Brothers Karamazov',
      type: 'essay',
      dueDate: addDays(t, 5),
      estimateMin: 150,
      status: 'in-progress',
      priority: 'medium',
      loggedMin: 45,
      createdAt: nowISO(),
    },
    {
      id: uid('asg'),
      courseId: calc.id,
      title: 'Midterm review session',
      type: 'exam',
      dueDate: addDays(t, 8),
      estimateMin: 180,
      status: 'not-started',
      priority: 'high',
      loggedMin: 0,
      createdAt: nowISO(),
    },
    {
      id: uid('asg'),
      courseId: chem.id,
      title: 'Problem set 5',
      type: 'homework',
      dueDate: addDays(t, -2),
      estimateMin: 60,
      status: 'done',
      priority: 'medium',
      loggedMin: 65,
      grade: 'A-',
      createdAt: nowISO(),
    },
  ];

  // --- Tasks ---------------------------------------------------------------
  const tasks: Task[] = [
    {
      id: uid('task'),
      title: 'Call grandmother',
      area: 'social',
      priority: 'medium',
      date: t,
      estimateMin: 20,
      completed: false,
      schedule: true,
      createdAt: nowISO(),
    },
    {
      id: uid('task'),
      title: 'Meal prep chicken and rice for the week',
      area: 'health',
      priority: 'high',
      date: t,
      estimateMin: 45,
      completed: false,
      schedule: true,
      createdAt: nowISO(),
    },
    {
      id: uid('task'),
      title: 'Refill creatine and protein',
      area: 'fitness',
      priority: 'low',
      date: t,
      estimateMin: 15,
      completed: true,
      completedAt: nowISO(),
      schedule: false,
      createdAt: nowISO(),
    },
    {
      id: uid('task'),
      title: 'Email the club treasurer about the budget',
      area: 'personal',
      priority: 'medium',
      date: addDays(t, 1),
      estimateMin: 15,
      completed: false,
      schedule: true,
      createdAt: nowISO(),
    },
    {
      id: uid('task'),
      title: 'Ask Fr. Nicholas about confession this week',
      area: 'faith',
      priority: 'high',
      date: addDays(t, -1),
      estimateMin: 10,
      completed: false,
      schedule: true,
      createdAt: nowISO(),
    },
    {
      id: uid('task'),
      title: 'Fix the squeak in the bike chain',
      area: 'personal',
      priority: 'low',
      estimateMin: 30,
      completed: false,
      schedule: false,
      createdAt: nowISO(),
    },
  ];

  // --- Meetings ------------------------------------------------------------
  const meetings: Meeting[] = [
    {
      id: uid('mtg'),
      title: 'Orthodox Christian Fellowship',
      kind: 'club',
      date: t,
      startTime: '17:00',
      endTime: '18:00',
      location: 'Student Center, Rm 204',
      repeat: 'weekly',
      notes: 'Bring the reading for the discussion.',
    },
    {
      id: uid('mtg'),
      title: 'Chemistry study group',
      kind: 'meeting',
      date: t,
      startTime: '19:30',
      endTime: '20:15',
      location: 'Library, 3rd floor',
      repeat: 'none',
    },
    {
      id: uid('mtg'),
      title: 'Robotics club build night',
      kind: 'club',
      date: addDays(t, 2),
      startTime: '18:00',
      endTime: '20:00',
      location: 'Engineering lab',
      repeat: 'weekly',
    },
    {
      id: uid('mtg'),
      title: 'Divine Liturgy',
      kind: 'church',
      date: addDays(t, (7 - new Date().getDay()) % 7 || 7),
      startTime: '09:00',
      endTime: '11:00',
      location: 'St. Nicholas Church',
      repeat: 'weekly',
    },
    {
      id: uid('mtg'),
      title: 'Advisor check-in',
      kind: 'meeting',
      date: addDays(t, 4),
      startTime: '13:00',
      endTime: '13:30',
      location: 'Faculty offices',
      repeat: 'none',
    },
  ];

  // --- Books & reading -----------------------------------------------------
  const books: Book[] = [
    {
      id: uid('book'),
      title: 'The Way of a Pilgrim',
      author: 'Anonymous',
      kind: 'spiritual',
      totalPages: 180,
      currentPage: 96,
      status: 'reading',
      startedAt: addDays(t, -12),
    },
    {
      id: uid('book'),
      title: 'The Orthodox Study Bible',
      kind: 'scripture',
      currentPage: 0,
      status: 'reading',
      startedAt: addDays(t, -30),
    },
    {
      id: uid('book'),
      title: 'The Brothers Karamazov',
      author: 'Fyodor Dostoevsky',
      kind: 'general',
      totalPages: 796,
      currentPage: 312,
      status: 'reading',
      startedAt: addDays(t, -20),
    },
    {
      id: uid('book'),
      title: 'Deep Work',
      author: 'Cal Newport',
      kind: 'general',
      totalPages: 296,
      currentPage: 296,
      status: 'finished',
      startedAt: addDays(t, -45),
      finishedAt: addDays(t, -14),
    },
  ];
  const [pilgrim, bible, karamazov] = books;

  // --- Goals ---------------------------------------------------------------
  const goals: Goal[] = [
    {
      id: uid('goal'),
      title: 'Keep the full prayer rule every day',
      description: 'Morning and evening prayers without skipping.',
      area: 'faith',
      unit: 'days',
      target: 7,
      current: 5,
      period: 'week',
      linkedHabitId: byName('Prayer rule').id,
      status: 'active',
      createdAt: nowISO(),
    },
    {
      id: uid('goal'),
      title: 'Train 5 days a week',
      area: 'fitness',
      unit: 'workouts',
      target: 5,
      current: 3,
      period: 'week',
      linkedHabitId: byName('Workout').id,
      status: 'active',
      createdAt: nowISO(),
    },
    {
      id: uid('goal'),
      title: 'Read 30 minutes daily',
      area: 'reading',
      unit: 'days',
      target: 7,
      current: 6,
      period: 'week',
      linkedHabitId: byName('Read').id,
      status: 'active',
      createdAt: nowISO(),
    },
    {
      id: uid('goal'),
      title: 'Finish The Brothers Karamazov',
      area: 'reading',
      unit: 'pages',
      target: 796,
      current: 312,
      period: 'month',
      dueDate: addDays(t, 30),
      status: 'active',
      createdAt: nowISO(),
    },
    {
      id: uid('goal'),
      title: 'Hold a 3.8 GPA this term',
      area: 'school',
      unit: 'assignments on time',
      target: 20,
      current: 14,
      period: 'month',
      status: 'active',
      createdAt: nowISO(),
    },
    {
      id: uid('goal'),
      title: 'Sleep 8 hours a night',
      area: 'health',
      unit: 'nights',
      target: 7,
      current: 4,
      period: 'week',
      status: 'active',
      createdAt: nowISO(),
    },
  ];

  // --- Fourteen days of history -------------------------------------------
  const sleep: SleepEntry[] = [];
  const health: HealthMetric[] = [];
  const workouts: Workout[] = [];
  const reading: ReadingSession[] = [];
  const meals: Meal[] = [];
  const habitLogs: HabitLog[] = [];
  const days: DayLog[] = [];

  const workoutPlan: { title: string; type: Workout['type']; exercises: [string, number, string][] }[] =
    [
      {
        title: 'Push day',
        type: 'push',
        exercises: [
          ['Bench press', 4, '6-8'],
          ['Overhead press', 3, '8-10'],
          ['Incline dumbbell press', 3, '10-12'],
          ['Cable fly', 3, '12-15'],
          ['Triceps pushdown', 3, '12-15'],
        ],
      },
      {
        title: 'Pull day',
        type: 'pull',
        exercises: [
          ['Deadlift', 3, '5'],
          ['Pull-ups', 4, 'AMRAP'],
          ['Barbell row', 3, '8-10'],
          ['Face pull', 3, '15'],
          ['Barbell curl', 3, '10-12'],
        ],
      },
      {
        title: 'Leg day',
        type: 'legs',
        exercises: [
          ['Back squat', 4, '5-6'],
          ['Romanian deadlift', 3, '8-10'],
          ['Leg press', 3, '10-12'],
          ['Walking lunge', 3, '12 each'],
          ['Calf raise', 4, '15'],
        ],
      },
      {
        title: 'Zone 2 run',
        type: 'cardio',
        exercises: [['Easy run', 1, '40 min']],
      },
    ];

  for (let i = 14; i >= 0; i--) {
    const date: ISODate = addDays(t, -i);
    const dow = fromISODate(date).getDay();
    const isPast = i > 0;

    // Sleep — trends up over the two weeks, with a couple of rough nights.
    const dur = Math.round(400 + wobble(i + 1, 110) + (14 - i) * 2);
    const wakeMin = 6 * 60 + 30 + Math.round(wobble(i + 3, 40) - 20);
    sleep.push({
      id: uid('sleep'),
      date,
      bedtime: `${String(Math.floor(((wakeMin - dur + 1440) % 1440) / 60)).padStart(2, '0')}:${String(
        Math.round(((wakeMin - dur + 1440) % 1440) % 60),
      ).padStart(2, '0')}`,
      wakeTime: `${String(Math.floor(wakeMin / 60)).padStart(2, '0')}:${String(wakeMin % 60).padStart(2, '0')}`,
      durationMin: dur,
      quality: (dur > 460 ? 4 : dur > 410 ? 3 : 2) as SleepEntry['quality'],
      restingHr: 52 + Math.round(wobble(i + 5, 6)),
      hrv: 60 + Math.round(wobble(i + 7, 25)),
      source: 'apple-watch',
      notes: i === 3 ? 'Stayed up finishing the lab report.' : undefined,
    });

    // Apple Watch Ultra metrics.
    health.push({
      id: uid('health'),
      date,
      steps: 7000 + Math.round(wobble(i + 11, 6000)),
      activeCalories: 420 + Math.round(wobble(i + 13, 380)),
      exerciseMin: 25 + Math.round(wobble(i + 17, 45)),
      standHours: 9 + Math.round(wobble(i + 19, 4)),
      restingHr: 52 + Math.round(wobble(i + 5, 6)),
      hrv: 60 + Math.round(wobble(i + 7, 25)),
      vo2max: 48 + Math.round(wobble(i + 23, 3) * 10) / 10,
      bodyWeight: 172 - (14 - i) * 0.08,
      source: 'apple-watch',
    });

    // Workouts: train Mon/Tue/Thu/Fri/Sat, rest Sun/Wed.
    const trains = ![0, 3].includes(dow);
    if (trains) {
      const plan = workoutPlan[(i + dow) % workoutPlan.length];
      workouts.push({
        id: uid('wo'),
        date,
        title: plan.title,
        type: plan.type,
        status: isPast ? (i === 6 ? 'skipped' : 'completed') : 'planned',
        startTime: '16:00',
        plannedMin: plan.type === 'cardio' ? 45 : 70,
        actualMin: isPast && i !== 6 ? 60 + Math.round(wobble(i + 29, 25)) : undefined,
        exercises: plan.exercises.map(([name, sets, reps]) => ({
          id: uid('ex'),
          name,
          targetSets: sets,
          targetReps: reps,
          sets: Array.from({ length: sets }, () => ({
            reps: Number(reps.split('-')[0]) || 10,
            weight: undefined,
            done: isPast && i !== 6,
          })),
        })),
        avgHr: isPast && i !== 6 ? 128 + Math.round(wobble(i + 31, 20)) : undefined,
        activeCalories: isPast && i !== 6 ? 380 + Math.round(wobble(i + 37, 180)) : undefined,
        rpe: isPast && i !== 6 ? 7 : undefined,
      });
    }

    // Reading — scripture most days, spiritual and general mixed in.
    if (i % 4 !== 2) {
      reading.push({
        id: uid('read'),
        date,
        bookId: bible.id,
        title: bible.title,
        kind: 'scripture',
        minutes: 12 + Math.round(wobble(i + 41, 8)),
        notes: i === 0 ? 'Epistle and Gospel of the day.' : undefined,
      });
    }
    if (i % 2 === 0) {
      reading.push({
        id: uid('read'),
        date,
        bookId: pilgrim.id,
        title: pilgrim.title,
        kind: 'spiritual',
        minutes: 20 + Math.round(wobble(i + 43, 15)),
        pages: 6 + Math.round(wobble(i + 47, 6)),
      });
    }
    if (i % 3 === 0) {
      reading.push({
        id: uid('read'),
        date,
        bookId: karamazov.id,
        title: karamazov.title,
        kind: 'general',
        minutes: 25 + Math.round(wobble(i + 53, 20)),
        pages: 14 + Math.round(wobble(i + 59, 12)),
      });
    }

    // Meals.
    const isFastDay = dow === 3 || dow === 5;
    const dayMeals: [Meal['type'], string, number, number][] = [
      ['breakfast', isFastDay ? 'Oatmeal, banana, black coffee' : 'Eggs, oatmeal, berries', 520, 34],
      ['lunch', isFastDay ? 'Lentil soup and bread' : 'Chicken, rice, broccoli', 720, 52],
      ['dinner', isFastDay ? 'Rice, beans, salad' : 'Salmon, potatoes, greens', 780, 48],
      ['snack', 'Greek yogurt and almonds', 280, 22],
    ];
    dayMeals.forEach(([type, name, cal, protein], idx) => {
      if (i === 0 && idx > 1) return; // today is still in progress
      meals.push({
        id: uid('meal'),
        date,
        type,
        name,
        time: ['07:15', '12:15', '18:30', '15:00'][idx],
        calories: cal + Math.round(wobble(i + idx + 61, 120) - 60),
        protein,
        carbs: Math.round(cal / 9),
        fat: Math.round(cal / 30),
        clean: !(i % 5 === 1 && idx === 3),
        fasting: isFastDay,
      });
    });

    // Habit logs — strong but imperfect, so streaks read as real.
    habits.forEach((h, hIdx) => {
      const roll = wobble(i * 31 + hIdx * 7 + 3, 1);
      const weekly = h.targetPerWeek / 7;
      // Church on Sunday, fasting on Wed/Fri — respect the real rhythm.
      let done = roll < 0.15 + weekly * 0.85;
      if (h.name === 'Church attendance') done = dow === 0;
      if (h.name === 'Fasting') done = isFastDay;
      if (h.name === 'Workout') done = trains && i !== 6;
      if (h.name === 'Confession preparation') done = dow === 6;
      if (i === 0) done = ['Wake up on time', 'Morning prayer', 'Prayer rule', 'Scripture reading'].includes(h.name);
      habitLogs.push({ id: uid('hl'), habitId: h.id, date, done });
    });

    days.push({
      date,
      waterCups: i === 0 ? 3 : 5 + Math.round(wobble(i + 67, 4)),
      mood: (3 + Math.round(wobble(i + 71, 2))) as DayLog['mood'],
      energy: (3 + Math.round(wobble(i + 73, 2))) as DayLog['energy'],
      reflection:
        i === 1
          ? 'Good day. Prayed before studying and the focus was noticeably better.'
          : undefined,
      gratitude: i === 1 ? 'Family, a warm kitchen, and a professor who explains well.' : undefined,
    });
  }

  // Today's workout should be waiting, not done.
  const todaysWorkout = workouts.find((w) => w.date === t);
  if (todaysWorkout) {
    todaysWorkout.status = 'planned';
    todaysWorkout.exercises.forEach((e) => e.sets.forEach((s) => (s.done = false)));
  }

  const state: AppState = {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, name: '' },
    tasks,
    habits,
    habitLogs,
    meals,
    sleep,
    workouts,
    books,
    reading,
    courses,
    assignments,
    meetings,
    goals,
    health,
    blocks: [],
    days,
  };

  // Sort meetings so the "next up" logic has a stable order to walk.
  state.meetings.sort((a, b) =>
    a.date === b.date ? toMinutes(a.startTime) - toMinutes(b.startTime) : a.date < b.date ? -1 : 1,
  );

  return state;
}
