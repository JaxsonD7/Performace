import type { AppState, ISODate, ScheduleBlock } from '@/types';
import { generateSchedule } from '@/lib/schedule';

/**
 * The seam for an AI planner.
 *
 * `generateSchedule` is already a pure (state, date) -> blocks function, which
 * is exactly the contract a model-backed planner would satisfy. Implement
 * `AiPlanner.plan` to call out to a model, and the Today and Schedule pages pick
 * it up without changing: same input, same output type.
 */
export interface DayPlanner {
  name: string;
  plan(state: AppState, date: ISODate, keep: ScheduleBlock[]): Promise<ScheduleBlock[]>;
}

/** The built-in rules planner, wrapped in the async planner interface. */
export const rulesPlanner: DayPlanner = {
  name: 'Built-in planner',
  async plan(state, date, keep) {
    return generateSchedule(state, date, { keep });
  },
};

export let activePlanner: DayPlanner = rulesPlanner;

export function setPlanner(planner: DayPlanner): void {
  activePlanner = planner;
}
