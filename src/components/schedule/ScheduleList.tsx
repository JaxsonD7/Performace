import { cx, IconButton, PencilIcon, TrashIcon } from '@/components/ui/primitives';
import { formatTime, nowClock, toMinutes } from '@/lib/date';
import { useBlockToggle } from '@/store/actions';
import { useStore } from '@/store/store';
import type { BlockKind, ScheduleBlock } from '@/types';

/**
 * Block color follows the kind of thing it is — a fixed mapping, so prayer is
 * always violet and the gym is always orange no matter what else is on the day.
 * The color rides a 3px rail; the text itself stays in ink tokens.
 */
const KIND_STYLE: Record<BlockKind, { rail: string; label: string }> = {
  prayer: { rail: 'bg-s7', label: 'Prayer' },
  school: { rail: 'bg-s1', label: 'School' },
  workout: { rail: 'bg-s2', label: 'Gym' },
  reading: { rail: 'bg-s3', label: 'Reading' },
  meal: { rail: 'bg-s4', label: 'Meal' },
  meeting: { rail: 'bg-s5', label: 'Meeting' },
  task: { rail: 'bg-s6', label: 'Task' },
  routine: { rail: 'bg-grid', label: 'Routine' },
  free: { rail: 'bg-grid', label: 'Break' },
  sleep: { rail: 'bg-s7', label: 'Sleep' },
};

export function ScheduleList({
  blocks,
  onEdit,
  showCurrent = true,
  emptyMessage = 'No schedule yet for this day.',
}: {
  blocks: ScheduleBlock[];
  onEdit?: (block: ScheduleBlock) => void;
  showCurrent?: boolean;
  emptyMessage?: string;
}) {
  const { remove } = useStore();
  const toggle = useBlockToggle();
  const now = toMinutes(nowClock());

  if (!blocks.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {blocks.map((b) => {
        const start = toMinutes(b.start);
        const end = toMinutes(b.end);
        const isNow = showCurrent && start <= now && now < end;
        const isPast = end <= now;
        const style = KIND_STYLE[b.kind];

        return (
          <li
            key={b.id}
            className={cx(
              'group flex items-stretch gap-3 px-3 py-2 transition-colors sm:px-4',
              isNow && 'bg-brand/[0.06]',
            )}
          >
            <span className={cx('w-1 shrink-0 rounded-full', style.rail)} aria-hidden="true" />

            <span className="w-16 shrink-0 pt-1.5 text-right text-xs tabular-nums text-ink-muted sm:w-20">
              {formatTime(b.start)}
            </span>

            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-1">
              <input
                type="checkbox"
                checked={b.completed}
                onChange={() => toggle(b.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--series-1))]"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cx(
                    'block truncate text-sm',
                    b.completed
                      ? 'text-ink-muted line-through'
                      : isPast
                        ? 'text-ink-secondary'
                        : 'text-ink',
                  )}
                >
                  {b.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                  <span>{style.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{end - start} min</span>
                  {isNow ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-brand">Now</span>
                    </>
                  ) : null}
                  {b.notes ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{b.notes}</span>
                    </>
                  ) : null}
                </span>
              </span>
            </label>

            {onEdit ? (
              <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton onClick={() => onEdit(b)} label="Edit block">
                  <PencilIcon />
                </IconButton>
                <IconButton onClick={() => remove('blocks', b.id)} label="Delete block" tone="danger">
                  <TrashIcon />
                </IconButton>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The "what's next" strip that sits above the day. */
export function NextUp({ block }: { block?: ScheduleBlock }) {
  if (!block) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
        Nothing left on the schedule — the day is yours.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/[0.07] px-4 py-3">
      <span className={cx('h-8 w-1 rounded-full', KIND_STYLE[block.kind].rail)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand">Next up</p>
        <p className="truncate text-sm font-medium text-ink">{block.title}</p>
      </div>
      <span className="shrink-0 text-sm tabular-nums text-ink-secondary">
        {formatTime(block.start)}
      </span>
    </div>
  );
}
