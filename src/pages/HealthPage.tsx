import { useMemo, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { HealthForm, MealForm, SleepForm, WorkoutForm } from '@/components/forms/logForms';
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
} from '@/components/ui/primitives';
import { BarChart, StatTile } from '@/components/ui/charts';
import { formatDuration, formatTime, hours, relativeDay, shortDay, startOfWeek, today } from '@/lib/date';
import { weekSummary } from '@/lib/metrics';
import { sumMacros } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { HealthMetric, Meal, SleepEntry, Workout } from '@/types';

type Tab = 'workouts' | 'sleep' | 'diet' | 'watch';

export function HealthPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('workouts');
  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );

  return (
    <>
      <PageHeader
        title="Health & gym"
        subtitle={`Training, sleep, food, and ${deviceName(state.settings.healthDevice)} data.`}
      >
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'workouts', label: 'Workouts' },
            { value: 'sleep', label: 'Sleep' },
            { value: 'diet', label: 'Diet' },
            { value: 'watch', label: 'Watch' },
          ]}
        />
      </PageHeader>

      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Workouts this week"
            value={week.workoutsCompleted}
            unit={`/ ${state.settings.workoutsPerWeekGoal}`}
            tone={week.workoutsCompleted >= state.settings.workoutsPerWeekGoal ? 'good' : 'default'}
          />
          <StatTile label="Avg sleep" value={hours(week.sleepAvgMin)} unit="h" />
          <StatTile label="Clean meals" value={`${week.cleanMealRate}%`} />
          <StatTile
            label="Avg steps"
            value={Math.round(
              week.steps.reduce((s, p) => s + p.value, 0) /
                (week.steps.filter((p) => p.value > 0).length || 1),
            ).toLocaleString()}
          />
        </div>

        {tab === 'workouts' ? <WorkoutsTab /> : null}
        {tab === 'sleep' ? <SleepTab /> : null}
        {tab === 'diet' ? <DietTab /> : null}
        {tab === 'watch' ? <WatchTab /> : null}
      </PageBody>
    </>
  );
}

function deviceName(source: string): string {
  return (
    { 'apple-watch': 'Apple Watch Ultra', 'apple-health': 'Apple Health', garmin: 'Garmin', fitbit: 'Fitbit', manual: 'manually entered' }[
      source
    ] ?? source
  );
}

// ---------------------------------------------------------------------------

function WorkoutsTab() {
  const { state, remove, update } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Workout }>({ open: false });
  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );

  const rows = [...state.workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader title="Training minutes this week" icon="🏋️" />
        <div className="card-pad">
          <BarChart
            data={week.workoutMinutes.map((p) => ({
              label: shortDay(p.date),
              value: p.value,
              caption: relativeDay(p.date),
              highlight: p.date === today(),
            }))}
            tone="s2"
            format={(v) => `${Math.round(v)} min`}
            emptyMessage="No sessions logged this week yet"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Workout log"
          icon="📋"
          action={
            <button
              type="button"
              className="btn-primary !py-1 text-xs"
              onClick={() => setModal({ open: true })}
            >
              + Workout
            </button>
          }
        />
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((w) => (
              <li key={w.id} className="group flex items-center gap-3 px-4 py-2.5">
                <div className="w-20 shrink-0 text-xs text-ink-muted">{relativeDay(w.date)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{w.title}</p>
                  <p className="text-[11px] capitalize text-ink-muted">
                    {w.type} · {formatDuration(w.actualMin ?? w.plannedMin)}
                    {w.avgHr ? ` · ${w.avgHr} bpm` : ''}
                    {w.activeCalories ? ` · ${w.activeCalories} kcal` : ''}
                  </p>
                </div>
                {w.status === 'completed' ? (
                  <Badge tone="good">✓ Done</Badge>
                ) : w.status === 'skipped' ? (
                  <Badge tone="critical">✕ Skipped</Badge>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost !py-1 text-xs"
                    onClick={() =>
                      update('workouts', w.id, {
                        status: 'completed',
                        actualMin: w.actualMin ?? w.plannedMin,
                      })
                    }
                  >
                    Complete
                  </button>
                )}
                <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => setModal({ open: true, item: w })} label="Edit workout">
                    <PencilIcon />
                  </IconButton>
                  <IconButton onClick={() => remove('workouts', w.id)} label="Delete" tone="danger">
                    <TrashIcon />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No workouts yet. Plan one and it lands on your schedule." />
        )}
        <WorkoutForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SleepTab() {
  const { state, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: SleepEntry }>({ open: false });
  const goal = state.settings.sleepGoalMin;

  const recent = [...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  const chart = [...recent].reverse();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Sleep, last two weeks" icon="🛏️" subtitle={`Goal: ${hours(goal)} hours`} />
        <div className="card-pad">
          <BarChart
            data={chart.map((s) => ({
              label: shortDay(s.date),
              value: s.durationMin,
              caption: relativeDay(s.date),
              highlight: s.date === today(),
            }))}
            target={goal}
            targetLabel={`${hours(goal)}h goal`}
            tone="s7"
            height={120}
            format={(v) => `${hours(v)} h`}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sleep log"
          icon="📋"
          action={
            <button
              type="button"
              className="btn-primary !py-1 text-xs"
              onClick={() => setModal({ open: true })}
            >
              + Sleep
            </button>
          }
        />
        {recent.length ? (
          <div className="scroll-x">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-medium">Night</th>
                  <th className="px-4 py-2 font-medium">In bed</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Quality</th>
                  <th className="px-4 py-2 font-medium">RHR / HRV</th>
                  <th className="w-20 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((s) => (
                  <tr key={s.id} className="group">
                    <td className="px-4 py-2 text-ink-secondary">{relativeDay(s.date)}</td>
                    <td className="px-4 py-2 tabular-nums text-ink-muted">
                      {formatTime(s.bedtime)} → {formatTime(s.wakeTime)}
                    </td>
                    <td className="px-4 py-2 font-medium tabular-nums text-ink">
                      {hours(s.durationMin)}h
                    </td>
                    <td className="px-4 py-2 text-ink-secondary">{s.quality}/5</td>
                    <td className="px-4 py-2 tabular-nums text-ink-muted">
                      {s.restingHr ?? '—'} / {s.hrv ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => setModal({ open: true, item: s })} label="Edit">
                          <PencilIcon />
                        </IconButton>
                        <IconButton onClick={() => remove('sleep', s.id)} label="Delete" tone="danger">
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No sleep logged yet." />
        )}
        <SleepForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DietTab() {
  const { state, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Meal }>({ open: false });

  const byDate = useMemo(() => {
    const map = new Map<string, Meal[]>();
    [...state.meals]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach((m) => {
        const list = map.get(m.date) ?? [];
        list.push(m);
        map.set(m.date, list);
      });
    return [...map.entries()].slice(0, 10);
  }, [state.meals]);

  return (
    <Card>
      <CardHeader
        title="Meal log"
        icon="🥗"
        action={
          <button
            type="button"
            className="btn-primary !py-1 text-xs"
            onClick={() => setModal({ open: true })}
          >
            + Meal
          </button>
        }
      />
      {byDate.length ? (
        <div className="divide-y divide-line">
          {byDate.map(([date, meals]) => {
            const macros = sumMacros(meals);
            return (
              <div key={date}>
                <div className="flex items-baseline justify-between bg-raised px-4 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {relativeDay(date)}
                  </p>
                  <p className="text-[11px] tabular-nums text-ink-muted">
                    {macros.calories} kcal · {macros.protein}g protein
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {meals.map((m) => (
                    <li key={m.id} className="group flex items-center gap-3 px-4 py-2">
                      <span className="w-20 shrink-0 text-xs capitalize text-ink-muted">
                        {m.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{m.name}</p>
                        <p className="text-[11px] text-ink-muted">
                          {m.calories ? `${m.calories} kcal` : 'no calories logged'}
                          {m.protein ? ` · ${m.protein}g protein` : ''}
                        </p>
                      </div>
                      {m.fasting ? <Badge tone="brand">Fast</Badge> : null}
                      {m.clean ? <Badge tone="good">✓ Clean</Badge> : <Badge tone="warning">⚠ Off plan</Badge>}
                      <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => setModal({ open: true, item: m })} label="Edit meal">
                          <PencilIcon />
                        </IconButton>
                        <IconButton onClick={() => remove('meals', m.id)} label="Delete" tone="danger">
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No meals logged yet." />
      )}
      <MealForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function WatchTab() {
  const { state, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: HealthMetric }>({ open: false });
  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );
  const recent = [...state.health].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  const latest = recent[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Steps this week"
          icon="👟"
          subtitle={`Goal: ${state.settings.stepGoal.toLocaleString()} per day`}
        />
        <div className="card-pad">
          <BarChart
            data={week.steps.map((p) => ({
              label: shortDay(p.date),
              value: p.value,
              caption: relativeDay(p.date),
              highlight: p.date === today(),
            }))}
            target={state.settings.stepGoal}
            targetLabel="goal"
            format={(v) => Math.round(v).toLocaleString()}
          />
        </div>
      </Card>

      {latest ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Resting HR" value={latest.restingHr ?? '—'} unit="bpm" />
          <StatTile label="HRV" value={latest.hrv ?? '—'} unit="ms" />
          <StatTile label="VO₂ max" value={latest.vo2max ?? '—'} />
          <StatTile label="Weight" value={latest.bodyWeight?.toFixed(1) ?? '—'} />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Daily metrics"
          icon="⌚"
          subtitle="Manual for now — the importer drops straight into this table."
          action={
            <button
              type="button"
              className="btn-primary !py-1 text-xs"
              onClick={() => setModal({ open: true })}
            >
              + Entry
            </button>
          }
        />
        {recent.length ? (
          <div className="scroll-x">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-4 py-2 font-medium">Steps</th>
                  <th className="px-4 py-2 font-medium">Active kcal</th>
                  <th className="px-4 py-2 font-medium">Exercise</th>
                  <th className="px-4 py-2 font-medium">RHR</th>
                  <th className="px-4 py-2 font-medium">HRV</th>
                  <th className="w-20 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((h) => (
                  <tr key={h.id} className="group">
                    <td className="px-4 py-2 text-ink-secondary">{relativeDay(h.date)}</td>
                    <td className="px-4 py-2 tabular-nums text-ink">
                      {h.steps?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {h.activeCalories ?? '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {h.exerciseMin ? `${h.exerciseMin}m` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">{h.restingHr ?? '—'}</td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">{h.hrv ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => setModal({ open: true, item: h })} label="Edit">
                          <PencilIcon />
                        </IconButton>
                        <IconButton onClick={() => remove('health', h.id)} label="Delete" tone="danger">
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No watch data yet." />
        )}
        <HealthForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
      </Card>

      <Card>
        <CardHeader title="Apple Watch Ultra import" icon="🔌" />
        <div className="card-pad space-y-2 text-sm text-ink-secondary">
          <p>
            Nothing syncs automatically yet — this version is fully local and asks nothing of the
            network. The adapter seam is already in place at{' '}
            <code className="rounded bg-raised px-1 py-0.5 text-xs">src/integrations/health</code>:
            drop an Apple Health export (or a Garmin/Fitbit CSV) through the parser there and each
            day lands in this table as a normal record.
          </p>
          <Progress
            value={recent.length}
            max={14}
            label="Days with metrics, last two weeks"
            hint={`${recent.length}/14`}
          />
        </div>
      </Card>
    </div>
  );
}
