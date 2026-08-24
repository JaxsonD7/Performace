import { addDays, fromISODate, fromMinutes, relativeDay, today, toMinutes } from '@/lib/date';
import { uid } from '@/lib/id';
import { meetingsOn } from '@/lib/selectors';
import { routineOn } from '@/lib/routine';
import type { AppState, BlockKind, ClockTime, ISODate, ScheduleBlock, Weekday } from '@/types';

/**
 * Builds a day plan out of what is actually known, not what is guessed.
 *
 * The rules, in order of authority:
 *   1. Blocks you made or edited by hand are law — they are never moved.
 *   2. Meetings are fixed commitments and are placed next.
 *   3. Class time is placed only where you have told the app you have a class
 *      — a `CourseMeeting` you entered by hand or that came from a syllabus.
 *      Nothing about school hours is ever guessed.
 *   4. Whatever gaps remain get filled with school work first (soonest due
 *      date wins), then tasks, split into focus blocks with breaks between —
 *      but only for an assignment or task you have explicitly opted into
 *      scheduling (`schedule: true`); everything else stays empty for you to
 *      fill in by hand with "+ Block" or "+ Event".
 *
 * Wake/prayer/meals/workout/reading/wind-down are routine *targets*, not
 * known commitments for a given day — they used to be auto-placed as blocks,
 * which meant "Build the day" filled the whole day whether or not any of
 * that was actually true that day. They are intentionally left out here; add
 * them by hand when they're real for that day.
 *
 * It is intentionally a pure function of (state, date, keep) so that swapping in
 * an AI planner later means replacing this one call, not rewiring the UI.
 */

const MIN_FILLABLE_GAP = 25;
const TRANSITION_MIN = 5;

/** "Due today" / "Due Friday" — relative words stay lowercase, weekdays do not. */
function dueLabel(date: ISODate): string {
  const rel = relativeDay(date);
  return `Due ${['Today', 'Tomorrow', 'Yesterday'].includes(rel) ? rel.toLowerCase() : rel}`;
}

interface Placed {
  start: number;
  end: number;
}

function overlaps(a: Placed, list: Placed[]): boolean {
  return list.some((b) => a.start < b.end && b.start < a.end);
}

function block(
  date: ISODate,
  start: number,
  end: number,
  title: string,
  kind: BlockKind,
  source: ScheduleBlock['source'],
  notes?: string,
): ScheduleBlock {
  return {
    id: uid('blk'),
    date,
    start: fromMinutes(start),
    end: fromMinutes(end),
    title,
    kind,
    source,
    completed: false,
    manual: false,
    notes,
  };
}

export interface GenerateOptions {
  /** Blocks to preserve untouched — hand-made, hand-edited, or already done. */
  keep?: ScheduleBlock[];
}

export function generateSchedule(
  state: AppState,
  date: ISODate,
  options: GenerateOptions = {},
): ScheduleBlock[] {
  const s = state.settings;
  const routine = routineOn(s, date);
  const keep = options.keep ?? [];
  const out: ScheduleBlock[] = [...keep];
  const taken: Placed[] = keep.map((b) => ({
    start: toMinutes(b.start),
    end: toMinutes(b.end) || 1440,
  }));

  const dayStart = toMinutes(routine.wakeTime);
  const dayEnd = toMinutes(routine.bedTime);

  // --- 1. Meetings: fixed commitments -------------------------------------
  meetingsOn(state, date).forEach((m) => {
    const start = toMinutes(m.startTime);
    const end = toMinutes(m.endTime);
    const slot = { start, end: Math.max(end, start + 15) };
    if (overlaps(slot, taken)) return;
    out.push(
      block(date, slot.start, slot.end, m.title, 'meeting', { type: 'meeting', id: m.id }, m.location),
    );
    taken.push(slot);
  });

  // --- 1b. A workout you actually planned for this date, at its own time --
  // (Not a routine-time guess — only a real Workout entry with a startTime.)
  const workout = state.workouts.find(
    (w) => w.date === date && w.status !== 'skipped' && w.startTime,
  );
  if (workout?.startTime) {
    const start = toMinutes(workout.startTime);
    const slot = { start, end: start + workout.plannedMin };
    if (!overlaps(slot, taken)) {
      out.push(block(date, slot.start, slot.end, workout.title, 'workout', { type: 'workout', id: workout.id }));
      taken.push(slot);
    }
  }

  // --- 2. Class time -------------------------------------------------------
  // Only classes you have actually told the app about — a CourseMeeting you
  // entered by hand or pulled from a syllabus. Nothing about school hours is
  // ever guessed or auto-filled.
  const weekday = fromISODate(date).getDay() as Weekday;
  state.courseMeetings
    .filter((m) => m.weekday === weekday)
    .forEach((m) => {
      const course = state.courses.find((c) => c.id === m.courseId);
      const start = toMinutes(m.startTime);
      const end = Math.max(toMinutes(m.endTime), start + 15);
      const span = { start, end };
      if (overlaps(span, taken)) return;
      out.push(
        block(
          date,
          span.start,
          span.end,
          course?.name ?? 'Class',
          'school',
          { type: 'course', id: m.id },
          m.location,
        ),
      );
      taken.push(span);
    });

  // --- 3. Free gaps --------------------------------------------------------
  const gaps: Placed[] = [];
  const sorted = [...taken].sort((a, b) => a.start - b.start);
  let cursor = dayStart;
  sorted.forEach((slot) => {
    if (slot.start - cursor >= MIN_FILLABLE_GAP) {
      gaps.push({ start: cursor + TRANSITION_MIN, end: slot.start });
    }
    cursor = Math.max(cursor, slot.end);
  });
  if (dayEnd - cursor >= MIN_FILLABLE_GAP) {
    gaps.push({ start: cursor + TRANSITION_MIN, end: dayEnd });
  }

  // --- 4. Queue of flexible work ------------------------------------------
  const priorityWeight = { high: 0, medium: 1, low: 2 };

  interface QueueItem {
    title: string;
    remaining: number;
    kind: BlockKind;
    source: ScheduleBlock['source'];
    notes?: string;
  }

  const queue: QueueItem[] = [];

  // Homework is never auto-placed unless you have opted a specific assignment
  // in — same rule as tasks, and the same reason classes are never guessed.
  state.assignments
    .filter((a) => a.status !== 'done' && a.schedule && a.dueDate >= date)
    .sort((a, b) =>
      a.dueDate === b.dueDate
        ? priorityWeight[a.priority] - priorityWeight[b.priority]
        : a.dueDate < b.dueDate
          ? -1
          : 1,
    )
    // Only pull forward work that is due within the next few days — planning
    // next week's essay into today's gaps is how a schedule stops being real.
    .slice(0, 4)
    .forEach((a) => {
      const remaining = Math.max(20, a.estimateMin - a.loggedMin);
      queue.push({
        title: a.title,
        remaining,
        kind: 'school',
        source: { type: 'assignment', id: a.id },
        notes: dueLabel(a.dueDate),
      });
    });

  state.tasks
    .filter((t) => !t.completed && t.schedule && (!t.date || t.date <= date))
    .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority])
    .forEach((t) => {
      queue.push({
        title: t.title,
        remaining: t.estimateMin,
        kind: 'task',
        source: { type: 'task', id: t.id },
      });
    });

  // --- 5. Fill the gaps ----------------------------------------------------
  let qi = 0;
  gaps.forEach((gap) => {
    let at = gap.start;
    while (qi < queue.length && gap.end - at >= MIN_FILLABLE_GAP) {
      const item = queue[qi];
      const available = gap.end - at;
      const chunk = Math.min(item.remaining, s.focusBlockMin, available);
      out.push(block(date, at, at + chunk, item.title, item.kind, item.source, item.notes));
      at += chunk;
      item.remaining -= chunk;
      if (item.remaining <= 5) qi += 1;
      // A break after a full-length focus block, not after a 20 minute scrap.
      if (chunk >= s.focusBlockMin && gap.end - at > s.breakMin + MIN_FILLABLE_GAP) {
        out.push(block(date, at, at + s.breakMin, 'Break', 'free', { type: 'manual' }));
        at += s.breakMin;
      } else {
        at += TRANSITION_MIN;
      }
    }
  });

  return out.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** Blocks a regenerate must not touch: hand-made, hand-edited, or completed. */
export function protectedBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return blocks.filter((b) => b.manual || b.completed);
}

/** How far ahead the schedule keeps itself built, in days (including today). */
export const SCHEDULE_LOOKAHEAD_DAYS = 30;

/**
 * Keeps a rolling window of days regenerated automatically — the client-side
 * replacement for a manual "Build the day" button. Every day in
 * `[today, today + days)` gets its non-protected blocks rebuilt from whatever
 * is currently known (meetings, class times, a timed workout, opted-in
 * school work/tasks); days outside that window are left exactly as they are.
 */
export function ensureScheduleAhead(state: AppState, days = SCHEDULE_LOOKAHEAD_DAYS): ScheduleBlock[] {
  const start = today();
  const window = new Set<ISODate>();
  for (let i = 0; i < days; i += 1) window.add(addDays(start, i));

  const untouched = state.blocks.filter((b) => !window.has(b.date));
  const rebuilt = [...window].flatMap((date) => {
    const existing = state.blocks.filter((b) => b.date === date);
    return generateSchedule(state, date, { keep: protectedBlocks(existing) });
  });
  return [...untouched, ...rebuilt];
}

/** The block happening right now, if any. */
export function currentBlock(blocks: ScheduleBlock[], now: ClockTime): ScheduleBlock | undefined {
  const n = toMinutes(now);
  return blocks.find((b) => toMinutes(b.start) <= n && n < toMinutes(b.end));
}

/** The next block that has not started yet and is not already done. */
export function nextBlock(blocks: ScheduleBlock[], now: ClockTime): ScheduleBlock | undefined {
  const n = toMinutes(now);
  return blocks
    .filter((b) => toMinutes(b.start) > n && !b.completed)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
}
