import type { ExerciseDef, MuscleGroup } from '@/types';

/**
 * The built-in exercise library. These are not stored in AppState — they are
 * static data merged at read time with the user's own `customExercises`, so a
 * fresh install already has a useful list to autocomplete against without
 * writing hundreds of records into localStorage.
 */

function def(name: string, muscles: MuscleGroup[], equipment?: string): ExerciseDef {
  return { id: `lib_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, muscles, equipment, custom: false };
}

export const EXERCISE_LIBRARY: ExerciseDef[] = [
  // Chest
  def('Barbell bench press', ['chest', 'triceps', 'shoulders'], 'barbell'),
  def('Incline barbell press', ['chest', 'shoulders', 'triceps'], 'barbell'),
  def('Incline dumbbell press', ['chest', 'shoulders', 'triceps'], 'dumbbell'),
  def('Dumbbell bench press', ['chest', 'triceps', 'shoulders'], 'dumbbell'),
  def('Cable fly', ['chest'], 'cable'),
  def('Dumbbell fly', ['chest'], 'dumbbell'),
  def('Push-up', ['chest', 'triceps', 'core'], 'bodyweight'),
  def('Dip', ['chest', 'triceps'], 'bodyweight'),

  // Back
  def('Deadlift', ['back', 'hamstrings', 'glutes', 'core'], 'barbell'),
  def('Pull-up', ['back', 'biceps'], 'bodyweight'),
  def('Chin-up', ['back', 'biceps'], 'bodyweight'),
  def('Lat pulldown', ['back', 'biceps'], 'cable'),
  def('Barbell row', ['back', 'biceps'], 'barbell'),
  def('Pendlay row', ['back', 'biceps'], 'barbell'),
  def('Dumbbell row', ['back', 'biceps'], 'dumbbell'),
  def('Seated cable row', ['back', 'biceps'], 'cable'),
  def('T-bar row', ['back', 'biceps'], 'barbell'),
  def('Face pull', ['back', 'shoulders'], 'cable'),
  def('Rack pull', ['back', 'hamstrings'], 'barbell'),

  // Shoulders
  def('Overhead press', ['shoulders', 'triceps'], 'barbell'),
  def('Dumbbell shoulder press', ['shoulders', 'triceps'], 'dumbbell'),
  def('Arnold press', ['shoulders', 'triceps'], 'dumbbell'),
  def('Lateral raise', ['shoulders'], 'dumbbell'),
  def('Front raise', ['shoulders'], 'dumbbell'),
  def('Rear delt fly', ['shoulders', 'back'], 'dumbbell'),
  def('Upright row', ['shoulders', 'back'], 'barbell'),
  def('Shrug', ['back', 'shoulders'], 'barbell'),

  // Arms
  def('Barbell curl', ['biceps'], 'barbell'),
  def('Dumbbell curl', ['biceps'], 'dumbbell'),
  def('Hammer curl', ['biceps'], 'dumbbell'),
  def('Preacher curl', ['biceps'], 'barbell'),
  def('Cable curl', ['biceps'], 'cable'),
  def('Triceps pushdown', ['triceps'], 'cable'),
  def('Overhead triceps extension', ['triceps'], 'dumbbell'),
  def('Skull crusher', ['triceps'], 'barbell'),
  def('Close-grip bench press', ['triceps', 'chest'], 'barbell'),

  // Legs
  def('Back squat', ['quads', 'glutes', 'hamstrings', 'core'], 'barbell'),
  def('Front squat', ['quads', 'glutes', 'core'], 'barbell'),
  def('Goblet squat', ['quads', 'glutes'], 'dumbbell'),
  def('Romanian deadlift', ['hamstrings', 'glutes', 'back'], 'barbell'),
  def('Leg press', ['quads', 'glutes'], 'machine'),
  def('Walking lunge', ['quads', 'glutes', 'hamstrings'], 'dumbbell'),
  def('Bulgarian split squat', ['quads', 'glutes'], 'dumbbell'),
  def('Leg extension', ['quads'], 'machine'),
  def('Leg curl', ['hamstrings'], 'machine'),
  def('Hip thrust', ['glutes', 'hamstrings'], 'barbell'),
  def('Calf raise', ['calves'], 'machine'),
  def('Seated calf raise', ['calves'], 'machine'),

  // Core
  def('Plank', ['core'], 'bodyweight'),
  def('Hanging leg raise', ['core'], 'bodyweight'),
  def('Cable crunch', ['core'], 'cable'),
  def('Ab wheel rollout', ['core'], 'bodyweight'),
  def('Russian twist', ['core'], 'bodyweight'),

  // Cardio / conditioning
  def('Easy run', ['cardio'], undefined),
  def('Interval run', ['cardio'], undefined),
  def('Rowing machine', ['cardio', 'back'], 'machine'),
  def('Assault bike', ['cardio'], 'machine'),
  def('Jump rope', ['cardio'], undefined),
  def('Stair climber', ['cardio'], 'machine'),
];

export function combinedExerciseLibrary(custom: ExerciseDef[]): ExerciseDef[] {
  return [...custom, ...EXERCISE_LIBRARY];
}

export function findExercise(library: ExerciseDef[], name: string): ExerciseDef | undefined {
  const norm = name.trim().toLowerCase();
  return library.find((e) => e.name.toLowerCase() === norm);
}
