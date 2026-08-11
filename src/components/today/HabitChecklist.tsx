import { Checkbox, IconButton, PencilIcon, cx } from '@/components/ui/primitives';
import { habitStreak } from '@/lib/metrics';
import { startOfWeek } from '@/lib/date';
import { useHabitToggle } from '@/store/actions';
import { useStore } from '@/store/store';
import type { Habit, HabitLog, ISODate } from '@/types';

/**
 * The checklist body shared by the daily improvement list and the Orthodox
 * rule. Both are habits; only the grouping differs.
 */
export function HabitChecklist({
  habits,
  logs,
  date,
  onEdit,
  showStreak = true,
}: {
  habits: Habit[];
  logs: Map<string, HabitLog>;
  date: ISODate;
  onEdit?: (habit: Habit) => void;
  showStreak?: boolean;
}) {
  const { state } = useStore();
  const toggle = useHabitToggle();
  const weekStart = startOfWeek(date, state.settings.weekStartsOn);

  if (!habits.length) {
    return <p className="px-4 py-6 text-center text-sm text-ink-muted">Nothing here yet.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {habits.map((h) => {
        const done = logs.get(h.id)?.done ?? false;
        const streak = showStreak ? habitStreak(state, h, weekStart) : null;

        return (
          <li key={h.id} className="group flex items-center gap-2 px-2 sm:px-3">
            <div className="min-w-0 flex-1">
              <Checkbox
                checked={done}
                onChange={(next) => toggle(h.id, date, next)}
                icon={h.icon}
                label={h.name}
                sublabel={h.notes}
              />
            </div>

            {streak ? (
              <div className="shrink-0 text-right">
                <p
                  className={cx(
                    'text-xs font-semibold tabular-nums',
                    streak.current > 0 ? 'text-ink-secondary' : 'text-ink-muted',
                  )}
                  title={`Current streak: ${streak.current} days · Longest: ${streak.longest}`}
                >
                  {streak.current > 0 ? `${streak.current}d` : '—'}
                </p>
                <p className="text-[10px] tabular-nums text-ink-muted">
                  {streak.weekDone}/{streak.weekTarget} wk
                </p>
              </div>
            ) : null}

            {onEdit ? (
              <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton onClick={() => onEdit(h)} label={`Edit ${h.name}`}>
                  <PencilIcon />
                </IconButton>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
