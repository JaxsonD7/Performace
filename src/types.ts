/**
 * The complete domain model for the tracker.
 *
 * Every record is a flat, serializable object with a string `id` and, where it
 * belongs to a day, an ISO `date` ("YYYY-MM-DD") in the user's local time. That
 * shape is deliberate: it maps 1:1 onto localStorage today and onto IndexedDB
 * object stores or SQLite tables later without touching any UI code.
 */

/** ISO calendar date, local time: "YYYY-MM-DD". */
export type ISODate = string;
/** 24h clock time: "HH:MM". */
export type ClockTime = string;
/** 0 = Sunday, matching Date#getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type LifeArea =
  | 'faith'
  | 'fitness'
  | 'school'
  | 'reading'
  | 'health'
  | 'personal'
  | 'social';

export type Priority = 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  notes?: string;
  area: LifeArea;
  priority: Priority;
  /** Day the task should be done. Undefined = someday/backlog. */
  date?: ISODate;
  estimateMin: number;
  completed: boolean;
  completedAt?: string;
  /** When true the scheduler will place this task into a free block. */
  schedule: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Habits (daily checklist + Orthodox practices share this shape)
// ---------------------------------------------------------------------------

/**
 * `improvement` habits render in the Daily Improvement checklist,
 * `orthodox` habits render in the Orthodox Rule section,
 * `general` habits are tracked but live only on the Goals page.
 */
export type HabitGroup = 'improvement' | 'orthodox' | 'general';

export interface Habit {
  id: string;
  name: string;
  group: HabitGroup;
  icon: string;
  /** How many days per week counts as "on track". 7 = every day. */
  targetPerWeek: number;
  /** Optional anchor time — the scheduler places a block for it when set. */
  anchorTime?: ClockTime;
  /** Minutes the scheduler should reserve when `anchorTime` is set. */
  durationMin?: number;
  notes?: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: ISODate;
  done: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Diet
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  id: string;
  date: ISODate;
  type: MealType;
  name: string;
  time?: ClockTime;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Self-assessed: did this meal fit the plan? Drives the "eat clean" streak. */
  clean: boolean;
  /** True when the meal was kept within a fasting rule (Orthodox fast days). */
  fasting?: boolean;
  notes?: string;
  /** A compressed data URL — the visual record, and the input to photo analysis. */
  photo?: string;
  /** Set once Claude Vision has filled in the fields below from the photo. */
  analyzed?: boolean;
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface SleepEntry {
  id: string;
  /** The date you woke up on — one sleep record per calendar day. */
  date: ISODate;
  bedtime: ClockTime;
  wakeTime: ClockTime;
  /** Derived from bedtime/wakeTime on save, stored so trends stay cheap. */
  durationMin: number;
  quality: 1 | 2 | 3 | 4 | 5;
  restingHr?: number;
  hrv?: number;
  /** Where the numbers came from — manual today, watch import later. */
  source: DataSource;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type WorkoutStatus = 'planned' | 'completed' | 'skipped';

export type WorkoutType =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'full-body'
  | 'cardio'
  | 'mobility'
  | 'sport'
  | 'rest';

export interface ExerciseSet {
  reps: number;
  weight?: number;
  done: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  sets: ExerciseSet[];
  /** Seconds to rest after this exercise's sets. Falls back to the global default. */
  restSec?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full-body'
  | 'cardio';

export interface ExerciseDef {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  equipment?: string;
  /** True for exercises the user added; false for the built-in library. */
  custom: boolean;
}

/** A saved list of exercises you can drop into a new workout in one tap. */
export interface WorkoutTemplateExercise {
  name: string;
  targetSets: number;
  targetReps: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  type: WorkoutType;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
}

export interface Workout {
  id: string;
  date: ISODate;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  startTime?: ClockTime;
  plannedMin: number;
  actualMin?: number;
  exercises: Exercise[];
  /** Filled from the watch (or by hand) after the session. */
  avgHr?: number;
  activeCalories?: number;
  rpe?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type ReadingKind = 'scripture' | 'spiritual' | 'school' | 'general';

export interface Book {
  id: string;
  title: string;
  author?: string;
  kind: ReadingKind;
  totalPages?: number;
  currentPage: number;
  status: 'reading' | 'finished' | 'paused' | 'queued';
  startedAt?: ISODate;
  finishedAt?: ISODate;
}

export interface ReadingSession {
  id: string;
  date: ISODate;
  bookId?: string;
  /** Denormalized so a session survives its book being deleted. */
  title: string;
  kind: ReadingKind;
  minutes: number;
  pages?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------

export type AssignmentStatus = 'not-started' | 'in-progress' | 'done';

export interface Course {
  id: string;
  name: string;
  code?: string;
  instructor?: string;
  /** Categorical slot index 1-8 so a course keeps its color everywhere. */
  colorSlot: number;
}

/**
 * A recurring class meeting — the schedule only ever shows class time you have
 * explicitly told it about, whether typed in by hand or pulled from a syllabus.
 * Nothing is inferred or auto-filled.
 */
export interface CourseMeeting {
  id: string;
  courseId: string;
  weekday: Weekday;
  startTime: ClockTime;
  endTime: ClockTime;
  location?: string;
}

export interface Assignment {
  id: string;
  courseId?: string;
  title: string;
  type: 'homework' | 'reading' | 'project' | 'exam' | 'quiz' | 'essay' | 'other';
  dueDate: ISODate;
  estimateMin: number;
  status: AssignmentStatus;
  priority: Priority;
  /** Minutes already logged against the assignment. */
  loggedMin: number;
  grade?: string;
  notes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Meetings, clubs, church
// ---------------------------------------------------------------------------

export type MeetingKind = 'club' | 'class' | 'meeting' | 'church' | 'social' | 'other';

export interface Meeting {
  id: string;
  title: string;
  kind: MeetingKind;
  date: ISODate;
  startTime: ClockTime;
  endTime: ClockTime;
  location?: string;
  /** Weekly repeat on the same weekday — enough for clubs and liturgy. */
  repeat: 'none' | 'weekly';
  attended?: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalPeriod = 'day' | 'week' | 'month' | 'year';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  area: LifeArea;
  /** What one unit of progress is: "workouts", "pages", "days". */
  unit: string;
  target: number;
  /** Manual progress counter — bumped from the Goals page. */
  current: number;
  period: GoalPeriod;
  /** Optional habit whose completions auto-count toward this goal. */
  linkedHabitId?: string;
  dueDate?: ISODate;
  status: 'active' | 'done' | 'paused';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Watch / health metrics
// ---------------------------------------------------------------------------

export type DataSource = 'manual' | 'apple-watch' | 'apple-health' | 'garmin' | 'fitbit';

export interface HealthMetric {
  id: string;
  date: ISODate;
  steps?: number;
  activeCalories?: number;
  exerciseMin?: number;
  standHours?: number;
  restingHr?: number;
  hrv?: number;
  vo2max?: number;
  respiratoryRate?: number;
  wristTempDelta?: number;
  bodyWeight?: number;
  waterCups?: number;
  source: DataSource;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type BlockKind =
  | 'sleep'
  | 'prayer'
  | 'meal'
  | 'workout'
  | 'reading'
  | 'school'
  | 'meeting'
  | 'task'
  | 'routine'
  | 'free';

/** Which record a generated block came from, so edits can flow back. */
export interface BlockSource {
  type:
    | 'task'
    | 'assignment'
    | 'meeting'
    | 'workout'
    | 'habit'
    | 'reading'
    | 'meal'
    | 'course'
    | 'manual';
  id?: string;
}

export interface ScheduleBlock {
  id: string;
  date: ISODate;
  start: ClockTime;
  end: ClockTime;
  title: string;
  kind: BlockKind;
  source: BlockSource;
  completed: boolean;
  /** Hand-made or hand-edited blocks survive a regenerate untouched. */
  manual: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Per-day journal
// ---------------------------------------------------------------------------

export interface DayLog {
  date: ISODate;
  waterCups: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  reflection?: string;
  gratitude?: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark';
export type WeightUnit = 'lb' | 'kg';
/** Fixed feasts on the civil (Gregorian) date most US jurisdictions use, or
 * the all-Julian dates some jurisdictions keep. Pascha follows the same
 * Paschalion either way — only the fixed feasts and fasts shift. */
export type OrthodoxCalendar = 'new' | 'old';

/**
 * One day's rhythm. Every field is optional here so a day can override just
 * what's different about it (a Saturday with no workout time, say) while
 * `DEFAULT_ROUTINE` fills the rest — see `resolveRoutine`.
 */
export interface DayRoutine {
  wakeTime: ClockTime;
  bedTime: ClockTime;
  breakfastTime: ClockTime;
  lunchTime: ClockTime;
  dinnerTime: ClockTime;
  /** Unset means no workout anchor is placed that day. */
  workoutTime?: ClockTime;
  readingTime: ClockTime;
}

export interface Settings {
  name: string;
  theme: ThemePreference;
  /** 0 = Sunday. Orthodox weeks and US school weeks both start Sunday. */
  weekStartsOn: 0 | 1;
  /** One routine per weekday — wake/sleep/meal times are rarely the same every day. */
  routines: Record<Weekday, DayRoutine>;
  /** Longest stretch of focused work the scheduler will place at once. */
  focusBlockMin: number;
  breakMin: number;
  waterGoalCups: number;
  readingGoalMin: number;
  sleepGoalMin: number;
  proteinGoal: number;
  calorieGoal: number;
  stepGoal: number;
  workoutsPerWeekGoal: number;
  /** Which device the health numbers are expected to come from. */
  healthDevice: DataSource;
  weightUnit: WeightUnit;
  /** Default rest between sets, in seconds — the rest timer starts here. */
  restTimerSec: number;
  orthodoxCalendar: OrthodoxCalendar;
  /**
   * Stored only in this browser and sent only to Anthropic, straight from your
   * device, when you ask the app to analyze a meal photo. Never touches any
   * server of this app's own.
   */
  anthropicApiKey?: string;
}

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

export interface AppState {
  /** Bumped when the persisted shape changes; drives migrations on load. */
  version: number;
  settings: Settings;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  meals: Meal[];
  sleep: SleepEntry[];
  workouts: Workout[];
  workoutTemplates: WorkoutTemplate[];
  customExercises: ExerciseDef[];
  books: Book[];
  reading: ReadingSession[];
  courses: Course[];
  courseMeetings: CourseMeeting[];
  assignments: Assignment[];
  meetings: Meeting[];
  goals: Goal[];
  health: HealthMetric[];
  blocks: ScheduleBlock[];
  days: DayLog[];
}

/** Keys of AppState that hold arrays of records with an `id`. */
export type CollectionKey =
  | 'tasks'
  | 'habits'
  | 'habitLogs'
  | 'meals'
  | 'sleep'
  | 'workouts'
  | 'workoutTemplates'
  | 'customExercises'
  | 'books'
  | 'reading'
  | 'courses'
  | 'courseMeetings'
  | 'assignments'
  | 'meetings'
  | 'goals'
  | 'health'
  | 'blocks';

export type RecordOf<K extends CollectionKey> = AppState[K][number];
