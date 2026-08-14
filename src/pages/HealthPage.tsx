import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { HealthForm, MealForm, SleepForm, WorkoutForm } from '@/components/forms/logForms';
import { HealthImportModal } from '@/components/health/HealthImportModal';
import { PantryTab } from '@/components/health/PantryTab';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  PencilIcon,
  Progress,
  Segmented,
  Select,
  TextInput,
  TrashIcon,
} from '@/components/ui/primitives';
import { BarChart, StatTile } from '@/components/ui/charts';
import { formatDuration, formatTime, hours, relativeDay, shortDay, startOfWeek, today } from '@/lib/date';
import { exerciseProgress, loggedExerciseNames, platesFor } from '@/lib/lifting';
import { weekSummary } from '@/lib/metrics';
import { sumMacros } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { HealthMetric, Meal, SleepEntry, Workout } from '@/types';

type Tab = 'workouts' | 'sleep' | 'diet' | 'pantry' | 'watch';

export function HealthPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('workouts');
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured once into local state, independent of the URL param that carried
  // it — clearing the param (below) must not also erase the data before the
  // import modal has had a chance to show it.
  const [shortcutData, setShortcutData] = useState<string | undefined>();
  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );

  // A Shortcut's "Open URL" step lands here as ?data=<json> — jump straight to
  // the watch tab with the import already parsed and waiting to confirm.
  useEffect(() => {
    const data = searchParams.get('data');
    if (!data) return;
    setShortcutData(data);
    setTab('watch');
    // Consumed once; clearing it means reloading the page later doesn't
    // silently re-offer a stale import.
    setSearchParams((p) => {
      p.delete('data');
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            { value: 'pantry', label: 'Pantry' },
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
        {tab === 'pantry' ? <PantryTab /> : null}
        {tab === 'watch' ? <WatchTab shortcutData={shortcutData} /> : null}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ExerciseProgressCard />
        <PlateCalculatorCard />
      </div>

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

function ExerciseProgressCard() {
  const { state } = useStore();
  const names = useMemo(() => loggedExerciseNames(state), [state]);
  const [name, setName] = useState(names[0] ?? '');
  const active = names.includes(name) ? name : names[0];
  const points = active ? exerciseProgress(state, active) : [];
  const unit = state.settings.weightUnit;

  return (
    <Card>
      <CardHeader
        title="Exercise progress"
        icon="📈"
        subtitle="Best estimated 1-rep max, session by session."
        action={
          names.length ? (
            <Select
              value={active}
              onChange={(e) => setName(e.target.value)}
              className="!w-auto !py-1 text-xs"
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          ) : null
        }
      />
      <div className="card-pad">
        {points.length ? (
          <BarChart
            data={points.slice(-10).map((p) => ({
              label: shortDay(p.date),
              value: Math.round(p.est1RM),
              caption: `${relativeDay(p.date)} — ${p.weight}${unit}×${p.reps}`,
            }))}
            tone="brand"
            format={(v) => `${Math.round(v)} ${unit}`}
            emptyMessage="Log a few sessions to see progress"
          />
        ) : (
          <EmptyState message="Log a workout with weights to see progress here." />
        )}
      </div>
    </Card>
  );
}

function PlateCalculatorCard() {
  const { state } = useStore();
  const unit = state.settings.weightUnit;
  const [target, setTarget] = useState(135);
  const [bar, setBar] = useState(unit === 'kg' ? 20 : 45);
  const result = platesFor(target, bar, unit);

  return (
    <Card>
      <CardHeader title="Plate calculator" icon="➕" />
      <div className="card-pad space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Target weight (${unit})`}>
            <TextInput
              type="number"
              min={0}
              step={unit === 'kg' ? 2.5 : 5}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label={`Bar weight (${unit})`}>
            <TextInput
              type="number"
              min={0}
              value={bar}
              onChange={(e) => setBar(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="rounded-lg bg-raised px-3 py-2.5">
          {result.perSide.length ? (
            <>
              <p className="text-xs text-ink-muted">Per side</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {result.perSide.join(' + ')} {unit}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-secondary">Just the bar.</p>
          )}
          {result.approximate ? (
            <p className="mt-1 text-xs text-warning">
              Closest with these plates: {result.reachable} {unit}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
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
    <>
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
    </>
  );
}

// ---------------------------------------------------------------------------

function WatchTab({ shortcutData }: { shortcutData?: string }) {
  const { state, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: HealthMetric }>({ open: false });
  const [importOpen, setImportOpen] = useState(!!shortcutData);
  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );
  const recent = [...state.health].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  const latest = recent[0];

  return (
    <div className="space-y-4">
      {!state.health.length ? (
        <Card>
          <div className="card-pad flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">⌚ Pair your Apple Watch</p>
              <p className="mt-0.5 max-w-md text-xs text-ink-secondary">
                No app can talk to the Watch directly over Bluetooth — the real "pairing" here is a
                Shortcut that pushes today's numbers in one tap, or a one-time Health export for
                everything before today.
              </p>
            </div>
            <button type="button" className="btn-primary shrink-0" onClick={() => setImportOpen(true)}>
              Set it up
            </button>
          </div>
        </Card>
      ) : null}

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
          subtitle="From Apple Health, a Shortcut, or by hand."
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => setImportOpen(true)}
              >
                Pair / Import
              </button>
              <button
                type="button"
                className="btn-primary !py-1 text-xs"
                onClick={() => setModal({ open: true })}
              >
                + Entry
              </button>
            </div>
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
        <CardHeader title="Apple Watch Ultra" icon="⌚" />
        <div className="card-pad space-y-2 text-sm text-ink-secondary">
          <p>
            Two ways to bring in real data: a daily iOS Shortcut for today's numbers in one tap, or
            an Apple Health export for a full history backfill. Both are covered by the Import
            button above — details and the exact Shortcut recipe are in there.
          </p>
          <Progress
            value={recent.length}
            max={14}
            label="Days with metrics, last two weeks"
            hint={`${recent.length}/14`}
          />
        </div>
      </Card>

      <HealthImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        initialData={shortcutData}
      />
    </div>
  );
}
