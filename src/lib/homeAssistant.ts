import { addDays, fromISODate, toISODate, toMinutes } from '@/lib/date';
import { dayScore } from '@/lib/metrics';
import { routineOn } from '@/lib/routine';
import { generateSchedule, nextBlock } from '@/lib/schedule';
import { sumMacros } from '@/lib/selectors';
import type {
  AppState,
  CanvasDigest,
  ClockTime,
  DeadlineDigest,
  FinanceDigest,
  HomeAssistantContext,
  ISODate,
  MailDigest,
  PackageDigest,
} from '@/types';

/** A block's kind counts as "study" for the heuristic study_block_* fields. */
const STUDY_KINDS = new Set(['school', 'task']);

function clockNow(now: Date): ClockTime {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Combines a calendar date with a local clock time into a full UTC ISO instant. */
function toISODateTime(date: ISODate, time: ClockTime): string {
  const [h, m] = time.split(':').map(Number);
  const d = fromISODate(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Pure — same (state, now) always produces the same output. This is what the
 * app pushes to the dedicated `performace-ha` repo for Home Assistant to
 * poll; nothing about it depends on Claude being reachable, since the app
 * itself computes and pushes it directly.
 */
export function computeHomeAssistantContext(state: AppState, now: Date): HomeAssistantContext {
  const today = toISODate(now);
  const tomorrow = addDays(today, 1);
  const nowClock = clockNow(now);

  const routineToday = routineOn(state.settings, today);
  const routineTomorrow = routineOn(state.settings, tomorrow);

  const todaysBlocks = generateSchedule(state, today);
  let next = nextBlock(todaysBlocks, nowClock);
  let nextDate = today;
  if (!next) {
    // Nothing left today — the day's next real thing is tomorrow's first block.
    const tomorrowsBlocks = generateSchedule(state, tomorrow);
    next = tomorrowsBlocks[0];
    nextDate = tomorrow;
  }

  const workoutToday = state.workouts.find((w) => w.date === today && w.status !== 'skipped');
  const gymTime = workoutToday?.startTime ?? routineToday.workoutTime ?? null;

  const studyBlock = todaysBlocks.find(
    (b) => STUDY_KINDS.has(b.kind) && toMinutes(b.start) > toMinutes(nowClock),
  );

  const day = state.days.find((d) => d.date === today);
  const waterGoal = state.settings.waterGoalOz;
  const calorieGoal = state.settings.calorieGoal;
  const caloriesToday = sumMacros(state.meals.filter((m) => m.date === today)).calories;

  return {
    generated_at: now.toISOString(),
    wake_time: routineToday.wakeTime,
    wake_time_tomorrow: routineTomorrow.wakeTime,
    bedtime_target: routineToday.bedTime,
    next_event_title: next?.title ?? null,
    next_event_kind: next?.kind ?? null,
    next_event_start: next ? toISODateTime(nextDate, next.start) : null,
    next_event_end: next ? toISODateTime(nextDate, next.end) : null,
    gym_today: !!gymTime,
    gym_time: gymTime,
    study_block_start: studyBlock ? toISODateTime(today, studyBlock.start) : null,
    study_block_end: studyBlock ? toISODateTime(today, studyBlock.end) : null,
    mood: day?.mood ?? null,
    energy: day?.energy ?? null,
    water_pct: waterGoal > 0 ? Math.round((day?.waterOz ?? 0) / waterGoal * 100) : null,
    calorie_pct: calorieGoal > 0 ? Math.round((caloriesToday / calorieGoal) * 100) : null,
    habit_completion_pct: dayScore(state, today).pct,
    // Attention flags need the fetched digest files, not just AppState — see computeAttentionFlags below.
    attention_needed: false,
    grade_posted: false,
  };
}

export interface DigestSnapshot {
  mail: MailDigest | null;
  finance: FinanceDigest | null;
  packages: PackageDigest | null;
  deadlines: DeadlineDigest | null;
  canvas: CanvasDigest | null;
}

/**
 * Separate from computeHomeAssistantContext because these need the already-
 * fetched digest files (mail/finance/etc.), not just AppState — the digests
 * live as static files the app fetches at runtime, not in AppState itself.
 * Still pure given its inputs; store.tsx does the fetching beforehand.
 */
export function computeAttentionFlags(
  state: AppState,
  digests: DigestSnapshot,
): Pick<HomeAssistantContext, 'attention_needed' | 'grade_posted'> {
  const undismissed = <T extends { id: string }>(items: T[] | undefined, dismissedIds: string[]) =>
    (items ?? []).filter((i) => !dismissedIds.includes(i.id));

  const highMail = undismissed(digests.mail?.emails, state.dismissedMailIds).some(
    (e) => e.importance === 'high',
  );
  const finance = undismissed(digests.finance?.items, state.dismissedFinanceIds).length > 0;
  const deadlines = undismissed(digests.deadlines?.items, state.dismissedDeadlineIds).length > 0;

  const today = toISODate(new Date());
  const gradePosted = (digests.canvas?.items ?? []).some((i) => i.receivedAt.slice(0, 10) === today);

  return {
    attention_needed: highMail || finance || deadlines,
    grade_posted: gradePosted,
  };
}
