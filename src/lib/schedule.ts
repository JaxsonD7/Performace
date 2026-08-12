import { fromISODate, fromMinutes, relativeDay, toMinutes } from '@/lib/date';
import { uid } from '@/lib/id';
import { meetingsOn } from '@/lib/selectors';
import { routineOn } from '@/lib/routine';
import type { AppState, BlockKind, ClockTime, ISODate, ScheduleBlock, Weekday } from '@/types';

/**
 * Builds a realistic day plan out of everything already tracked.
 *
 * The rules, in order of authority:
 *   1. Blocks you made or edited by hand are law — they are never moved.
 *   2. Meetings are fixed commitments and are placed next.
 *   3. Class time is placed only where you have told the app you have a class
 *      — a `CourseMeeting` you entered by hand or that came from a syllabus.
 *      Nothing about school hours is ever guessed.
 *   4. Anchors (wake, prayer, meals, workout, reading, wind-down) go at the
 *      times set for that day of the week, and are skipped when something
 *      fixed already occupies the slot rather than double-booking you.
 *   5. Whatever gaps remain get filled with school work first (soonest due
 *      date wins), then tasks, split into focus blocks with breaks between.
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

  /** Every stretch of the day not yet claimed, in order. */
  const freeGaps = (): Placed[] => {
    const gaps: Placed[] = [];
    let cursor = dayStart;
    [...taken]
      .sort((a, b) => a.start - b.start)
      .forEach((t) => {
        if (t.start > cursor) gaps.push({ start: cursor, end: t.start });
        cursor = Math.max(cursor, t.end);
      });
    if (dayEnd > cursor) gaps.push({ start: cursor, end: dayEnd });
    return gaps;
  };

  /**
   * Finds room for something that wants a particular time.
   *
   * A workout at 4pm behind a 5pm club meeting should slide to 6pm, not vanish
   * — but breakfast pushed to 3pm is worse than no breakfast block at all. So:
   * take the free gap nearest the preferred time, and give up entirely once the
   * drift passes what that kind of block can tolerate.
   */
  const findSlot = (preferred: number, dur: number, maxDrift: number): number | null => {
    let best: number | null = null;
    let bestDrift = Infinity;

    freeGaps().forEach((gap) => {
      if (gap.end - gap.start < dur) return;
      // Sit at the preferred time when the gap contains it, otherwise hug
      // whichever end of the gap is closest to it.
      const start = Math.min(Math.max(preferred, gap.start), gap.end - dur);
      const drift = Math.abs(start - preferred);
      if (drift < bestDrift) {
        bestDrift = drift;
        best = start;
      }
    });

    return bestDrift <= maxDrift ? best : null;
  };

  const place = (
    preferred: number,
    durationMin: number,
    title: string,
    kind: BlockKind,
    source: ScheduleBlock['source'],
    maxDrift = 120,
  ): boolean => {
    const start = findSlot(preferred, durationMin, maxDrift);
    if (start === null) return false;
    const slot = { start, end: start + durationMin };
    out.push(block(date, slot.start, slot.end, title, kind, source));
    taken.push(slot);
    return true;
  };

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

  // --- 3. Anchors ----------------------------------------------------------
  // Each carries how far it may drift: a meal an hour late is still a meal, a
  // meal five hours late is a lie, while the gym can move across the evening.
  const workout = state.workouts.find((w) => w.date === date && w.status !== 'skipped');
  type Anchor = [ClockTime, number, string, BlockKind, ScheduleBlock['source'], number];

  const anchors: Anchor[] = [
    [routine.breakfastTime, 30, 'Breakfast', 'meal', { type: 'meal' }, 60],
    [routine.lunchTime, 40, 'Lunch', 'meal', { type: 'meal' }, 90],
    [routine.dinnerTime, 45, 'Dinner', 'meal', { type: 'meal' }, 90],
    [routine.readingTime, s.readingGoalMin, 'Reading', 'reading', { type: 'reading' }, 180],
  ];

  // A workout only gets an anchor when there is something to anchor: either a
  // planned session (its own start time wins) or this weekday has a workout
  // time set at all. A rest day with no workout time set gets no gym block.
  const workoutTime = workout?.startTime ?? routine.workoutTime;
  if (workoutTime) {
    anchors.push([
      workoutTime,
      workout?.plannedMin ?? 60,
      workout ? workout.title : 'Workout',
      'workout',
      workout ? { type: 'workout', id: workout.id } : { type: 'manual' },
      240,
    ]);
  }

  // Habits with an anchor time (wake-up, prayer rule, evening reflection)
  // become blocks of their own.
  state.habits
    .filter((h) => !h.archived && h.anchorTime)
    .forEach((h) => {
      anchors.push([
        h.anchorTime!,
        h.durationMin ?? 15,
        h.name,
        h.group === 'orthodox' ? 'prayer' : 'routine',
        { type: 'habit', id: h.id },
        90,
      ]);
    });

  anchors
    .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]))
    .forEach(([time, dur, title, kind, source, drift]) => {
      place(toMinutes(time), dur, title, kind, source, drift);
    });

  // Wind-down closes the day so the evening does not silently run past bedtime.
  place(Math.max(dayStart, dayEnd - 30), 30, 'Wind down & sleep', 'sleep', { type: 'manual' }, 60);

  // --- 4. Free gaps --------------------------------------------------------
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

  // --- 5. Queue of flexible work ------------------------------------------
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

  // --- 6. Fill the gaps ----------------------------------------------------
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
