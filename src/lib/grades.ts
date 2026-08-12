import type { AppState, GradeCategory, GradeEntry } from '@/types';

/**
 * A course's current grade, computed straight from its syllabus weighting —
 * no separate "current grade" field to drift out of sync with what was
 * actually entered.
 */
export interface CourseGrade {
  /** null when nothing has been entered anywhere yet. */
  pct: number | null;
  byCategory: {
    category: GradeCategory;
    entries: GradeEntry[];
    /** Average score in this category (0-100), null if it has no entries yet. */
    avgPct: number | null;
  }[];
  /** Weight actually counted toward `pct` — categories with no entries are excluded, not scored as zero. */
  weightCounted: number;
  /** Weight across every category, entered or not — the denominator a final course grade settles against. */
  totalWeight: number;
}

export function courseGrade(state: AppState, courseId: string): CourseGrade {
  const categories = state.gradeCategories.filter((c) => c.courseId === courseId);
  const byCategory = categories.map((category) => {
    const entries = state.gradeEntries.filter((e) => e.categoryId === category.id);
    const avgPct = entries.length
      ? (entries.reduce((sum, e) => sum + (e.maxScore > 0 ? e.score / e.maxScore : 0), 0) / entries.length) * 100
      : null;
    return { category, entries, avgPct };
  });

  const scored = byCategory.filter((c) => c.avgPct != null);
  const weightCounted = scored.reduce((s, c) => s + c.category.weightPct, 0);
  const totalWeight = byCategory.reduce((s, c) => s + c.category.weightPct, 0);
  const pct = weightCounted > 0
    ? scored.reduce((sum, c) => sum + (c.avgPct as number) * c.category.weightPct, 0) / weightCounted
    : null;

  return { pct, byCategory, weightCounted, totalWeight };
}

export interface NeededAverage {
  /** Average score (0-100) needed across every not-yet-graded category to land on `targetPct` overall. */
  value: number;
  /** False once the math asks for more than 100% — the target is out of reach no matter what comes next. */
  achievable: boolean;
}

/**
 * What you'd need to average on everything not graded yet to land on
 * `targetPct` overall — the weight of ungraded categories is assumed to
 * eventually count in full, since a real final grade always settles against
 * the whole syllabus, not just the part graded so far.
 */
export function neededAverage(grade: CourseGrade, targetPct: number): NeededAverage | null {
  const remainingWeight = grade.totalWeight - grade.weightCounted;
  if (remainingWeight <= 0) return null;

  const earned = grade.byCategory.reduce(
    (sum, c) => sum + (c.avgPct ?? 0) * c.category.weightPct,
    0,
  );
  const value = (targetPct * grade.totalWeight - earned) / remainingWeight;
  return { value, achievable: value <= 100 };
}

/** A rough US letter grade, only for display — the percentage is the real number. */
export function letterGrade(pct: number): string {
  if (pct >= 97) return 'A+';
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}
