import { useCallback } from 'react';
import { useStore } from '@/store/store';
import type { ISODate } from '@/types';

/**
 * Ticking a habit is the single most common write in the app, so it gets a
 * dedicated hook: one log row per habit per day, created on first tick and
 * flipped thereafter.
 */
export function useHabitToggle() {
  const { state, add, update } = useStore();
  return useCallback(
    (habitId: string, date: ISODate, next?: boolean) => {
      const log = state.habitLogs.find((l) => l.habitId === habitId && l.date === date);
      const value = next ?? !(log?.done ?? false);
      if (log) update('habitLogs', log.id, { done: value });
      else add('habitLogs', { habitId, date, done: value });
    },
    [state.habitLogs, add, update],
  );
}

/** Marks a schedule block done, and carries that through to what it came from. */
export function useBlockToggle() {
  const { state, update } = useStore();
  return useCallback(
    (blockId: string) => {
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const completed = !block.completed;
      update('blocks', blockId, { completed });

      // Completing "Problem set 7" on the schedule should also move the
      // assignment along — the plan and the records should not drift apart.
      if (completed && block.source.id) {
        if (block.source.type === 'task') {
          update('tasks', block.source.id, {
            completed: true,
            completedAt: new Date().toISOString(),
          });
        }
        if (block.source.type === 'assignment') {
          const a = state.assignments.find((x) => x.id === block.source.id);
          if (a && a.status === 'not-started') update('assignments', a.id, { status: 'in-progress' });
        }
      }
    },
    [state.blocks, state.assignments, update],
  );
}
