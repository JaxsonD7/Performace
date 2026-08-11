import { useMemo, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { GoalForm, HabitForm } from '@/components/forms/entryForms';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  PencilIcon,
  Progress,
  Segmented,
  TrashIcon,
  cx,
} from '@/components/ui/primitives';
import { StatTile, WeekDots } from '@/components/ui/charts';
import { relativeDay, shortDay, startOfWeek, today, weekDates } from '@/lib/date';
import { goalProgress, habitStreak } from '@/lib/metrics';
import { useHabitToggle } from '@/store/actions';
import { useStore } from '@/store/store';
import type { Goal, Habit, LifeArea } from '@/types';

type Tab = 'goals' | 'orthodox' | 'habits';

const AREA_SLOT: Record<LifeArea, number> = {
  faith: 7,
  fitness: 2,
  school: 1,
  reading: 3,
  health: 6,
  personal: 5,
  social: 4,
};

export function GoalsPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('goals');
  const weekStart = startOfWeek(today(), state.settings.weekStartsOn);

  const active = state.goals.filter((g) => g.status === 'active');
  const onTrack = active.filter(
    (g) => goalProgress(state, g, weekStart) >= g.target * 0.7,
  ).length;
  const orthodox = state.habits.filter((h) => h.group === 'orthodox' && !h.archived);
  const orthodoxKept = orthodox.filter((h) =>
    state.habitLogs.some((l) => l.habitId === h.id && l.date === today() && l.done),
  ).length;

  return (
    <>
      <PageHeader
        title="Goals & rule of life"
        subtitle="What you are aiming at, and the practices that get you there."
      >
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'goals', label: `Goals (${active.length})` },
            { value: 'orthodox', label: 'Orthodox rule' },
            { value: 'habits', label: 'All habits' },
          ]}
        />
      </PageHeader>

      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Active goals" value={active.length} />
          <StatTile label="On track" value={`${onTrack}/${active.length}`} tone={onTrack === active.length && active.length > 0 ? 'good' : 'default'} />
          <StatTile label="Rule kept today" value={`${orthodoxKept}/${orthodox.length}`} />
          <StatTile label="Goals finished" value={state.goals.filter((g) => g.status === 'done').length} />
        </div>

        {tab === 'goals' ? <GoalsTab /> : null}
        {tab === 'orthodox' ? <HabitsTab group="orthodox" /> : null}
        {tab === 'habits' ? <HabitsTab /> : null}
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------------------

function GoalsTab() {
  const { state, update, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Goal }>({ open: false });
  const weekStart = startOfWeek(today(), state.settings.weekStartsOn);

  const groups = useMemo(() => {
    const byArea = new Map<LifeArea, Goal[]>();
    state.goals.forEach((g) => {
      const list = byArea.get(g.area) ?? [];
      list.push(g);
      byArea.set(g.area, list);
    });
    return [...byArea.entries()];
  }, [state.goals]);

  return (
    <Card>
      <CardHeader
        title="Goals"
        icon="✦"
        action={
          <button
            type="button"
            className="btn-primary !py-1 text-xs"
            onClick={() => setModal({ open: true })}
          >
            + Goal
          </button>
        }
      />
      {groups.length ? (
        <div className="divide-y divide-line">
          {groups.map(([area, goals]) => (
            <div key={area}>
              <p className="bg-raised px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {area}
              </p>
              <ul className="divide-y divide-line">
                {goals.map((g) => {
                  const current = goalProgress(state, g, weekStart);
                  const pct = Math.min(100, Math.round((current / Math.max(g.target, 1)) * 100));
                  const linked = state.habits.find((h) => h.id === g.linkedHabitId);
                  return (
                    <li key={g.id} className="group px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 h-8 w-1 shrink-0 rounded-full"
                          style={{ background: `rgb(var(--series-${AREA_SLOT[g.area]}))` }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cx(
                              'truncate text-sm font-medium',
                              g.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                            )}
                          >
                            {g.title}
                          </p>
                          <p className="truncate text-[11px] text-ink-muted">
                            {g.target} {g.unit} per {g.period}
                            {linked ? ` · follows ${linked.icon} ${linked.name}` : ''}
                            {g.dueDate ? ` · by ${relativeDay(g.dueDate)}` : ''}
                          </p>
                        </div>

                        {g.status === 'done' ? <Badge tone="good">✓ Done</Badge> : null}
                        {g.status === 'paused' ? <Badge>Paused</Badge> : null}

                        {!g.linkedHabitId && g.status === 'active' ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className="btn-ghost !px-2 !py-1 text-xs"
                              onClick={() => update('goals', g.id, { current: Math.max(0, g.current - 1) })}
                              aria-label="Decrease progress"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              className="btn-primary !px-2 !py-1 text-xs"
                              onClick={() => update('goals', g.id, { current: g.current + 1 })}
                              aria-label="Increase progress"
                            >
                              +
                            </button>
                          </div>
                        ) : null}

                        <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <IconButton onClick={() => setModal({ open: true, item: g })} label="Edit goal">
                            <PencilIcon />
                          </IconButton>
                          <IconButton onClick={() => remove('goals', g.id)} label="Delete goal" tone="danger">
                            <TrashIcon />
                          </IconButton>
                        </span>
                      </div>

                      <div className="mt-2 pl-3">
                        <Progress
                          value={current}
                          max={g.target}
                          hint={`${current} / ${g.target} ${g.unit} · ${pct}%`}
                          label=""
                          tone={pct >= 100 ? 'good' : 'brand'}
                        />
                      </div>

                      {g.description ? (
                        <p className="mt-1.5 pl-3 text-xs text-ink-secondary">{g.description}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No goals yet. Name one thing you want to be true in a month." />
      )}
      <GoalForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function HabitsTab({ group }: { group?: Habit['group'] }) {
  const { state, update, remove } = useStore();
  const toggle = useHabitToggle();
  const [modal, setModal] = useState<{ open: boolean; item?: Habit }>({ open: false });

  const weekStart = startOfWeek(today(), state.settings.weekStartsOn);
  const days = weekDates(weekStart);
  const t = today();

  const habits = state.habits
    .filter((h) => (group ? h.group === group : true))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card>
      <CardHeader
        title={group === 'orthodox' ? 'Orthodox rule of life' : 'All habits'}
        icon={group === 'orthodox' ? '✝️' : '✅'}
        subtitle="Tap any square to fix a day you forgot to check."
        action={
          <button
            type="button"
            className="btn-primary !py-1 text-xs"
            onClick={() => setModal({ open: true })}
          >
            + {group === 'orthodox' ? 'Practice' : 'Habit'}
          </button>
        }
      />
      {habits.length ? (
        <div className="scroll-x">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2 text-left font-medium">Practice</th>
                {days.map((d) => (
                  <th key={d} className="px-1 py-2 text-center font-medium">
                    {shortDay(d).slice(0, 1)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Streak</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {habits.map((h) => {
                const streak = habitStreak(state, h, weekStart);
                return (
                  <tr key={h.id} className="group">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">{h.icon}</span>
                        <span className={cx('truncate', h.archived ? 'text-ink-muted line-through' : 'text-ink')}>
                          {h.name}
                        </span>
                        <span className="text-[11px] text-ink-muted">{h.targetPerWeek}×/wk</span>
                      </span>
                    </td>
                    {days.map((d) => {
                      const done = state.habitLogs.some(
                        (l) => l.habitId === h.id && l.date === d && l.done,
                      );
                      const future = d > t;
                      return (
                        <td key={d} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            disabled={future}
                            onClick={() => toggle(h.id, d)}
                            aria-label={`${h.name} on ${d}`}
                            aria-pressed={done}
                            className={cx(
                              'h-6 w-6 rounded-md border transition-colors',
                              done
                                ? 'border-s1 bg-s1'
                                : future
                                  ? 'cursor-not-allowed border-dashed border-line'
                                  : 'border-line bg-surface hover:border-s1',
                            )}
                          >
                            {done ? (
                              <svg viewBox="0 0 16 16" className="mx-auto h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {streak.current}d
                      </span>
                      <span className="block text-[10px] tabular-nums text-ink-muted">
                        best {streak.longest}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => setModal({ open: true, item: h })} label="Edit">
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            update('habits', h.id, { archived: !h.archived });
                          }}
                          label={h.archived ? 'Restore' : 'Archive'}
                        >
                          <span className="text-xs">{h.archived ? '↺' : '⌁'}</span>
                        </IconButton>
                        <IconButton onClick={() => remove('habits', h.id)} label="Delete" tone="danger">
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="Nothing here yet." />
      )}

      {habits.length ? (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">This week</p>
          <div className="flex flex-wrap gap-4">
            {habits.slice(0, 6).map((h) => (
              <div key={h.id} className="flex items-center gap-2">
                <span className="text-xs text-ink-secondary">
                  {h.icon} {h.name}
                </span>
                <WeekDots
                  days={days.map((d) => ({
                    label: shortDay(d),
                    state: state.habitLogs.some((l) => l.habitId === h.id && l.date === d && l.done)
                      ? 'done'
                      : d > t
                        ? 'future'
                        : 'missed',
                  }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <HabitForm
        open={modal.open}
        onClose={() => setModal({ open: false })}
        initial={modal.item}
        group={group ?? 'improvement'}
      />
    </Card>
  );
}
