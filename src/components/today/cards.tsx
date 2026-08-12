import { useState } from 'react';
import { AssignmentForm, MeetingForm, TaskForm } from '@/components/forms/entryForms';
import {
  HealthForm,
  MealForm,
  ReadingForm,
  SleepForm,
  WorkoutForm,
} from '@/components/forms/logForms';
import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  IconButton,
  PencilIcon,
  Progress,
  TrashIcon,
  cx,
} from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/charts';
import { startRestTimer } from '@/components/lifting/RestTimer';
import { formatDuration, formatTime, hours, relativeDay } from '@/lib/date';
import { isNewPR, lastPerformance, summarizeSets } from '@/lib/lifting';
import { readingMinutes, sumMacros } from '@/lib/selectors';
import type { DayData } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { Assignment, Meal, Meeting, Task, Workout } from '@/types';

const addBtn = 'btn-quiet !px-2 !py-1 text-xs';

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export function SleepCard({ day }: { day: DayData }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const s = day.sleep;
  const goal = state.settings.sleepGoalMin;

  return (
    <Card>
      <CardHeader
        title="Sleep"
        icon="🛏️"
        action={
          <button type="button" className={addBtn} onClick={() => setOpen(true)}>
            {s ? 'Edit' : '+ Log'}
          </button>
        }
      />
      <div className="card-pad">
        {s ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
                  {hours(s.durationMin)}
                  <span className="ml-1 text-sm font-normal text-ink-secondary">h</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatTime(s.bedtime)} → {formatTime(s.wakeTime)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-muted">Quality</p>
                <p className="text-sm font-medium text-ink" aria-label={`${s.quality} out of 5`}>
                  {'●'.repeat(s.quality)}
                  <span className="text-grid">{'●'.repeat(5 - s.quality)}</span>
                </p>
              </div>
            </div>

            <div className="mt-3">
              <Progress
                value={s.durationMin}
                max={goal}
                label="Against your goal"
                hint={`${hours(s.durationMin)} / ${hours(goal)} h`}
                tone={s.durationMin >= goal ? 'good' : s.durationMin >= goal - 60 ? 'brand' : 'warning'}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-raised px-2.5 py-2">
                <dt className="text-ink-muted">Resting HR</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {s.restingHr ?? '—'} <span className="font-normal text-ink-muted">bpm</span>
                </dd>
              </div>
              <div className="rounded-lg bg-raised px-2.5 py-2">
                <dt className="text-ink-muted">HRV</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {s.hrv ?? '—'} <span className="font-normal text-ink-muted">ms</span>
                </dd>
              </div>
            </dl>
            {s.notes ? <p className="mt-3 text-xs text-ink-secondary">{s.notes}</p> : null}
          </>
        ) : (
          <EmptyState
            message="No sleep logged for last night."
            action={
              <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
                Log sleep
              </button>
            }
          />
        )}
      </div>
      <SleepForm open={open} onClose={() => setOpen(false)} initial={s} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Watch / health
// ---------------------------------------------------------------------------

export function HealthCard({ day }: { day: DayData }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const h = day.health;
  const stepGoal = state.settings.stepGoal;

  return (
    <Card>
      <CardHeader
        title="Watch & health"
        icon="⌚"
        subtitle={h ? sourceLabel(h.source) : 'Apple Watch Ultra'}
        action={
          <button type="button" className={addBtn} onClick={() => setOpen(true)}>
            {h ? 'Edit' : '+ Log'}
          </button>
        }
      />
      <div className="card-pad">
        {h ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Steps" value={(h.steps ?? 0).toLocaleString()} />
              <StatTile label="Active" value={h.activeCalories ?? '—'} unit="kcal" />
              <StatTile label="Exercise" value={h.exerciseMin ?? '—'} unit="min" />
              <StatTile label="Stand" value={h.standHours ?? '—'} unit="hrs" />
            </div>
            <div className="mt-3">
              <Progress
                value={h.steps ?? 0}
                max={stepGoal}
                label="Step goal"
                hint={`${(h.steps ?? 0).toLocaleString()} / ${stepGoal.toLocaleString()}`}
                tone={(h.steps ?? 0) >= stepGoal ? 'good' : 'brand'}
              />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {h.restingHr ? <Metric label="Resting HR" value={`${h.restingHr} bpm`} /> : null}
              {h.hrv ? <Metric label="HRV" value={`${h.hrv} ms`} /> : null}
              {h.vo2max ? <Metric label="VO₂ max" value={String(h.vo2max)} /> : null}
              {h.bodyWeight ? <Metric label="Weight" value={h.bodyWeight.toFixed(1)} /> : null}
            </dl>
          </>
        ) : (
          <EmptyState
            message="No watch data for today yet."
            action={
              <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
                Enter metrics
              </button>
            }
          />
        )}
      </div>
      <HealthForm open={open} onClose={() => setOpen(false)} initial={h} date={day.date} />
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-ink-secondary">{value}</dd>
    </div>
  );
}

function sourceLabel(source: string): string {
  return (
    {
      'apple-watch': 'From Apple Watch',
      'apple-health': 'From Apple Health',
      manual: 'Entered by hand',
      garmin: 'From Garmin',
      fitbit: 'From Fitbit',
    }[source] ?? source
  );
}

// ---------------------------------------------------------------------------
// Meals & water
// ---------------------------------------------------------------------------

export function MealsCard({ day }: { day: DayData }) {
  const { state, remove, updateDay } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | undefined>();
  const macros = sumMacros(day.meals);
  const s = state.settings;

  const openNew = () => {
    setEditing(undefined);
    setOpen(true);
  };
  const openEdit = (m: Meal) => {
    setEditing(m);
    setOpen(true);
  };

  const setWater = (next: number) =>
    updateDay(day.date, { waterCups: Math.max(0, Math.min(20, next)) });

  return (
    <Card>
      <CardHeader
        title="Diet & meals"
        icon="🥗"
        action={
          <button type="button" className={addBtn} onClick={openNew}>
            + Meal
          </button>
        }
      />
      <div className="card-pad space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Progress
            value={macros.calories}
            max={s.calorieGoal}
            label="Calories"
            hint={`${macros.calories} / ${s.calorieGoal}`}
          />
          <Progress
            value={macros.protein}
            max={s.proteinGoal}
            label="Protein"
            hint={`${macros.protein} / ${s.proteinGoal}g`}
            tone="s3"
          />
        </div>

        {day.meals.length ? (
          <ul className="divide-y divide-line">
            {day.meals.map((m) => (
              <li key={m.id} className="group flex items-center gap-2 py-2">
                {m.photo ? (
                  <img
                    src={m.photo}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{m.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                    <span className="capitalize">{m.type}</span>
                    {m.time ? <span>· {formatTime(m.time)}</span> : null}
                    {m.calories ? <span>· {m.calories} kcal</span> : null}
                    {m.protein ? <span>· {m.protein}g protein</span> : null}
                  </p>
                </div>
                {m.fasting ? <Badge tone="brand">Fast</Badge> : null}
                {m.clean ? <Badge tone="good">✓ Clean</Badge> : <Badge tone="warning">⚠ Off plan</Badge>}
                <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => openEdit(m)} label="Edit meal">
                    <PencilIcon />
                  </IconButton>
                  <IconButton onClick={() => remove('meals', m.id)} label="Delete meal" tone="danger">
                    <TrashIcon />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-ink-muted">Nothing logged yet today.</p>
        )}

        <div className="rounded-lg bg-raised px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-secondary">💧 Water</p>
              <p className="text-xs text-ink-muted">
                {day.day.waterCups} of {s.waterGoalCups} cups
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1"
                onClick={() => setWater(day.day.waterCups - 1)}
                aria-label="One cup less"
              >
                −
              </button>
              <button
                type="button"
                className="btn-primary !px-2.5 !py-1"
                onClick={() => setWater(day.day.waterCups + 1)}
                aria-label="One cup more"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-2">
            <Progress value={day.day.waterCups} max={s.waterGoalCups} tone="s3" />
          </div>
        </div>
      </div>
      <MealForm open={open} onClose={() => setOpen(false)} initial={editing} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export function WorkoutCard({ day }: { day: DayData }) {
  const { state, update, remove } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | undefined>();

  const openNew = () => {
    setEditing(undefined);
    setOpen(true);
  };

  const patchSet = (w: Workout, exerciseId: string, index: number, patch: Partial<Workout['exercises'][number]['sets'][number]>) => {
    const exercises = w.exercises.map((e) =>
      e.id === exerciseId
        ? { ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
        : e,
    );
    update('workouts', w.id, { exercises });
  };

  /** Ticking a set on starts the rest timer; PR badges are derived at render time. */
  const completeSet = (w: Workout, exercise: Workout['exercises'][number], index: number) => {
    const nowDone = !exercise.sets[index].done;
    patchSet(w, exercise.id, index, { done: nowDone });
    if (nowDone) startRestTimer(exercise.restSec ?? state.settings.restTimerSec, exercise.name);
  };

  return (
    <Card>
      <CardHeader
        title="Gym"
        icon="🏋️"
        action={
          <button type="button" className={addBtn} onClick={openNew}>
            + Workout
          </button>
        }
      />
      <div className="card-pad space-y-4">
        {day.workouts.length ? (
          day.workouts.map((w) => {
            const totalSets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
            const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

            return (
              <div key={w.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{w.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      <span className="capitalize">{w.type}</span> ·{' '}
                      {w.startTime ? `${formatTime(w.startTime)} · ` : ''}
                      {formatDuration(w.actualMin ?? w.plannedMin)}
                      {w.avgHr ? ` · ${w.avgHr} bpm avg` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {w.status === 'completed' ? (
                      <Badge tone="good">✓ Done</Badge>
                    ) : w.status === 'skipped' ? (
                      <Badge tone="critical">✕ Skipped</Badge>
                    ) : (
                      <Badge tone="brand">Planned</Badge>
                    )}
                    <IconButton
                      onClick={() => {
                        setEditing(w);
                        setOpen(true);
                      }}
                      label="Edit workout"
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => remove('workouts', w.id)}
                      label="Delete workout"
                      tone="danger"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>

                {totalSets > 0 ? (
                  <div className="mt-2">
                    <Progress
                      value={doneSets}
                      max={totalSets}
                      label="Sets completed"
                      hint={`${doneSets}/${totalSets}`}
                      tone="s2"
                    />
                  </div>
                ) : null}

                <ul className="mt-2 space-y-2.5">
                  {w.exercises.map((e) => {
                    const last = lastPerformance(state, e.name, w.date);
                    return (
                      <li key={e.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm text-ink-secondary">
                            {e.name}
                            <span className="ml-1.5 text-xs text-ink-muted">
                              {e.targetSets}×{e.targetReps}
                            </span>
                          </span>
                          {last ? (
                            <span className="shrink-0 text-[11px] text-ink-muted">
                              Last: {summarizeSets(last.sets, state.settings.weightUnit)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {e.sets.map((s, i) => {
                            const pr = isNewPR(state, e.name, s, w.date);
                            return (
                              <div
                                key={i}
                                className={cx(
                                  'flex items-center gap-1 rounded-md border px-1.5 py-1',
                                  s.done ? 'border-s2 bg-s2/10' : 'border-line bg-surface',
                                )}
                              >
                                <span className="w-3 text-center text-[10px] text-ink-muted">{i + 1}</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={s.weight ?? ''}
                                  onChange={(ev) =>
                                    patchSet(w, e.id, i, { weight: ev.target.valueAsNumber || undefined })
                                  }
                                  placeholder="0"
                                  aria-label={`${e.name} set ${i + 1} weight`}
                                  className="w-10 rounded border-0 bg-transparent text-right text-xs tabular-nums text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                                />
                                <span className="text-[10px] text-ink-muted">{state.settings.weightUnit}×</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={s.reps || ''}
                                  onChange={(ev) => patchSet(w, e.id, i, { reps: ev.target.valueAsNumber || 0 })}
                                  placeholder="0"
                                  aria-label={`${e.name} set ${i + 1} reps`}
                                  className="w-8 rounded border-0 bg-transparent text-right text-xs tabular-nums text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                                />
                                <button
                                  type="button"
                                  onClick={() => completeSet(w, e, i)}
                                  aria-label={`Mark ${e.name} set ${i + 1} done`}
                                  aria-pressed={s.done}
                                  className={cx(
                                    'flex h-5 w-5 items-center justify-center rounded transition-colors',
                                    s.done ? 'bg-s2 text-white' : 'border border-line text-ink-muted hover:border-s2',
                                  )}
                                >
                                  {s.done ? '✓' : ''}
                                </button>
                                {pr && s.done ? (
                                  <span
                                    className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold text-serious"
                                    title="New personal record"
                                  >
                                    PR
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {w.status !== 'completed' ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary flex-1 !py-1.5 text-xs"
                      onClick={() =>
                        update('workouts', w.id, {
                          status: 'completed',
                          actualMin: w.actualMin ?? w.plannedMin,
                        })
                      }
                    >
                      Mark complete
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !py-1.5 text-xs"
                      onClick={() => update('workouts', w.id, { status: 'skipped' })}
                    >
                      Skip
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState
            message="No workout planned for today."
            action={
              <button type="button" className="btn-ghost" onClick={openNew}>
                Plan a workout
              </button>
            }
          />
        )}
      </div>
      <WorkoutForm open={open} onClose={() => setOpen(false)} initial={editing} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function ReadingCard({ day }: { day: DayData }) {
  const { state, remove } = useStore();
  const [open, setOpen] = useState(false);
  const total = readingMinutes(day.reading);
  const goal = state.settings.readingGoalMin;
  const activeBooks = state.books.filter((b) => b.status === 'reading').slice(0, 3);

  return (
    <Card>
      <CardHeader
        title="Reading"
        icon="📖"
        action={
          <button type="button" className={addBtn} onClick={() => setOpen(true)}>
            + Session
          </button>
        }
      />
      <div className="card-pad space-y-3">
        <Progress
          value={total}
          max={goal}
          label="Today"
          hint={`${total} / ${goal} min`}
          tone={total >= goal ? 'good' : 'brand'}
        />

        {day.reading.length ? (
          <ul className="divide-y divide-line">
            {day.reading.map((r) => (
              <li key={r.id} className="group flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.title}</p>
                  <p className="text-[11px] capitalize text-ink-muted">
                    {r.kind} · {r.minutes} min{r.pages ? ` · ${r.pages} pages` : ''}
                  </p>
                </div>
                <IconButton
                  onClick={() => remove('reading', r.id)}
                  label="Delete session"
                  tone="danger"
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-center text-sm text-ink-muted">Nothing read yet today.</p>
        )}

        {activeBooks.length ? (
          <div className="space-y-2 border-t border-line pt-3">
            {activeBooks.map((b) =>
              b.totalPages ? (
                <Progress
                  key={b.id}
                  value={b.currentPage}
                  max={b.totalPages}
                  label={b.title}
                  hint={`${b.currentPage}/${b.totalPages}`}
                  tone="s7"
                />
              ) : (
                <p key={b.id} className="text-xs text-ink-muted">
                  {b.title}
                </p>
              ),
            )}
          </div>
        ) : null}
      </div>
      <ReadingForm open={open} onClose={() => setOpen(false)} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------

export function SchoolCard({ day, upcoming }: { day: DayData; upcoming: Assignment[] }) {
  const { state, update } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | undefined>();

  const rows = upcoming.slice(0, 6);

  return (
    <Card>
      <CardHeader
        title="School"
        icon="🎓"
        subtitle={`${day.assignments.length} due today`}
        action={
          <button
            type="button"
            className={addBtn}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            + Assignment
          </button>
        }
      />
      <div className="card-pad">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((a) => {
              const course = state.courses.find((c) => c.id === a.courseId);
              const overdue = a.dueDate < day.date;
              return (
                <li key={a.id} className="group flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={a.status === 'done'}
                    onChange={(e) =>
                      update('assignments', a.id, {
                        status: e.target.checked ? 'done' : 'in-progress',
                      })
                    }
                    className="h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--series-1))]"
                    aria-label={`Mark ${a.title} done`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{a.title}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                      {course ? (
                        <>
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: `rgb(var(--series-${course.colorSlot}))` }}
                            aria-hidden="true"
                          />
                          {course.name} ·{' '}
                        </>
                      ) : null}
                      {formatDuration(Math.max(0, a.estimateMin - a.loggedMin))} left
                    </p>
                  </div>
                  {overdue ? (
                    <Badge tone="critical">⚠ Overdue</Badge>
                  ) : (
                    <Badge tone={a.dueDate === day.date ? 'warning' : 'neutral'}>
                      {relativeDay(a.dueDate)}
                    </Badge>
                  )}
                  <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                      label="Edit assignment"
                    >
                      <PencilIcon />
                    </IconButton>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState message="No open assignments. Enjoy it." />
        )}
      </div>
      <AssignmentForm open={open} onClose={() => setOpen(false)} initial={editing} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function TasksCard({ day, overdue }: { day: DayData; overdue: Task[] }) {
  const { update, remove } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const rows = [...overdue, ...day.tasks];

  return (
    <Card>
      <CardHeader
        title="Tasks"
        icon="✓"
        subtitle={`${day.tasks.filter((t) => !t.completed).length} left today`}
        action={
          <button
            type="button"
            className={addBtn}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            + Task
          </button>
        }
      />
      <div className="card-pad">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <li key={t.id} className="group flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <Checkbox
                    checked={t.completed}
                    onChange={(next) =>
                      update('tasks', t.id, {
                        completed: next,
                        completedAt: next ? new Date().toISOString() : undefined,
                      })
                    }
                    label={t.title}
                    sublabel={
                      <span className="flex items-center gap-1.5">
                        <span className="capitalize">{t.area}</span>
                        <span>· {formatDuration(t.estimateMin)}</span>
                        {t.date && t.date < day.date ? (
                          <span className="font-medium text-critical">⚠ Overdue</span>
                        ) : null}
                      </span>
                    }
                  />
                </div>
                {t.priority === 'high' && !t.completed ? <Badge tone="serious">High</Badge> : null}
                <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    onClick={() => {
                      setEditing(t);
                      setOpen(true);
                    }}
                    label="Edit task"
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton onClick={() => remove('tasks', t.id)} label="Delete task" tone="danger">
                    <TrashIcon />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nothing on the list for today." />
        )}
      </div>
      <TaskForm open={open} onClose={() => setOpen(false)} initial={editing} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Meetings & clubs
// ---------------------------------------------------------------------------

export function MeetingsCard({ day }: { day: DayData }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | undefined>();

  return (
    <Card>
      <CardHeader
        title="Meetings & clubs"
        icon="👥"
        action={
          <button
            type="button"
            className={addBtn}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            + Event
          </button>
        }
      />
      <div className="card-pad">
        {day.meetings.length ? (
          <ul className="divide-y divide-line">
            {day.meetings.map((m) => (
              <li key={`${m.id}-${m.date}`} className="group flex items-center gap-2 py-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-ink-muted">
                  {formatTime(m.startTime)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{m.title}</p>
                  <p className="truncate text-[11px] capitalize text-ink-muted">
                    {m.kind}
                    {m.location ? ` · ${m.location}` : ''}
                    {m.repeat === 'weekly' ? ' · weekly' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => update('meetings', m.id, { attended: !m.attended })}
                  className={cx(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                    m.attended
                      ? 'border-good/30 bg-good/10 text-good'
                      : 'border-line text-ink-muted hover:text-ink',
                  )}
                >
                  {m.attended ? '✓ Went' : 'Mark attended'}
                </button>
                <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    onClick={() => {
                      setEditing(m);
                      setOpen(true);
                    }}
                    label="Edit event"
                  >
                    <PencilIcon />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nothing on the calendar today." />
        )}
      </div>
      <MeetingForm open={open} onClose={() => setOpen(false)} initial={editing} date={day.date} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Evening reflection
// ---------------------------------------------------------------------------

export function ReflectionCard({ day }: { day: DayData }) {
  const { updateDay } = useStore();

  return (
    <Card>
      <CardHeader title="Evening reflection" icon="🌙" />
      <div className="card-pad space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Rating
            label="Mood"
            value={day.day.mood}
            onChange={(mood) => updateDay(day.date, { mood })}
          />
          <Rating
            label="Energy"
            value={day.day.energy}
            onChange={(energy) => updateDay(day.date, { energy })}
          />
        </div>
        <label className="block">
          <span className="label">Thank God for</span>
          <textarea
            className="input min-h-[60px] resize-y"
            value={day.day.gratitude ?? ''}
            onChange={(e) => updateDay(day.date, { gratitude: e.target.value })}
            placeholder="Three things from today…"
          />
        </label>
        <label className="block">
          <span className="label">How did the day go?</span>
          <textarea
            className="input min-h-[80px] resize-y"
            value={day.day.reflection ?? ''}
            onChange={(e) => updateDay(day.date, { reflection: e.target.value })}
            placeholder="What went well, what to repent of, what to change tomorrow."
          />
        </label>
      </div>
    </Card>
  );
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-1">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n} of 5`}
            aria-pressed={value === n}
            className={cx(
              'h-8 flex-1 rounded-lg border text-xs font-semibold tabular-nums transition-colors',
              value === n
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink-muted hover:border-brand/50',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
