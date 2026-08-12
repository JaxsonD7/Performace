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
  const pct = weightCounted > 0
    ? scored.reduce((sum, c) => sum + (c.avgPct as number) * c.category.weightPct, 0) / weightCounted
    : null;

  return { pct, byCategory, weightCounted };
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
