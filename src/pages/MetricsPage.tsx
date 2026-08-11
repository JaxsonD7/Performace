import { useMemo, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import {
  Badge,
  Card,
  CardHeader,
  ChevronLeft,
  ChevronRight,
  EmptyState,
  IconButton,
  Progress,
} from '@/components/ui/primitives';
import { BarChart, StatTile, WeekDots } from '@/components/ui/charts';
import {
  addDays,
  formatDate,
  formatDuration,
  formatTime,
  hours,
  relativeDay,
  shortDay,
  startOfWeek,
  today,
} from '@/lib/date';
import { habitStreak, weekSummary } from '@/lib/metrics';
import { overdueTasks, upcomingMeetings } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { ISODate } from '@/types';

export function MetricsPage() {
  const { state } = useStore();
  const [weekStart, setWeekStart] = useState<ISODate>(() =>
    startOfWeek(today(), state.settings.weekStartsOn),
  );

  const week = useMemo(() => weekSummary(state, weekStart), [state, weekStart]);
  const habits = state.habits.filter((h) => !h.archived);
  const orthodox = habits.filter((h) => h.group === 'orthodox');
  const missed = useMemo(() => overdueTasks(state, today()), [state]);
  const upcoming = useMemo(() => upcomingMeetings(state, today(), 7), [state]);
  const isThisWeek = weekStart === startOfWeek(today(), state.settings.weekStartsOn);

  const label = (p: { date: ISODate; value: number }) => ({
    label: shortDay(p.date),
    value: p.value,
    caption: relativeDay(p.date),
    highlight: p.date === today(),
  });

  // Averages count only days that have actually happened — dividing a
  // Tuesday's effort by seven would make every week look like a failure.
  const avgSoFar = (points: { date: ISODate; value: number }[]) => {
    const elapsed = points.filter((p) => p.date <= today());
    return elapsed.length
      ? Math.round(elapsed.reduce((sum, p) => sum + p.value, 0) / elapsed.length)
      : 0;
  };
  const orthodoxAvg = avgSoFar(week.orthodoxCompletion);
  const habitAvg = avgSoFar(week.habitCompletion);

  return (
    <>
      <PageHeader
        title="Weekly metrics"
        subtitle={`${formatDate(weekStart, { month: 'long', day: 'numeric' })} – ${formatDate(
          addDays(weekStart, 6),
          { month: 'long', day: 'numeric' },
        )}`}
        actions={
          <div className="flex items-center gap-1">
            <IconButton onClick={() => setWeekStart(addDays(weekStart, -7))} label="Previous week">
              <ChevronLeft />
            </IconButton>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setWeekStart(startOfWeek(today(), state.settings.weekStartsOn))}
              disabled={isThisWeek}
            >
              This week
            </button>
            <IconButton onClick={() => setWeekStart(addDays(weekStart, 7))} label="Next week">
              <ChevronRight />
            </IconButton>
          </div>
        }
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Habit completion"
            value={`${habitAvg}%`}
            hint={`across ${habits.length} habits, days so far`}
            tone={habitAvg >= 80 ? 'good' : habitAvg >= 50 ? 'default' : 'warning'}
          />
          <StatTile
            label="Workouts"
            value={week.workoutsCompleted}
            unit={`/ ${state.settings.workoutsPerWeekGoal}`}
            tone={week.workoutsCompleted >= state.settings.workoutsPerWeekGoal ? 'good' : 'default'}
          />
          <StatTile label="Avg sleep" value={hours(week.sleepAvgMin)} unit="h" />
          <StatTile
            label="Missed tasks"
            value={week.missedTasks}
            tone={week.missedTasks > 0 ? 'critical' : 'good'}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Sleep"
              icon="🛏️"
              subtitle={`Averaging ${hours(week.sleepAvgMin)}h against a ${hours(
                state.settings.sleepGoalMin,
              )}h goal`}
            />
            <div className="card-pad">
              <BarChart
                data={week.sleepMinutes.map(label)}
                target={state.settings.sleepGoalMin}
                targetLabel="goal"
                tone="s7"
                format={(v) => `${hours(v)} h`}
                emptyMessage="No sleep logged this week"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Workout consistency"
              icon="🏋️"
              subtitle={`${week.workoutsCompleted} of ${week.workoutsPlanned} planned sessions completed`}
            />
            <div className="card-pad">
              <BarChart
                data={week.workoutMinutes.map(label)}
                tone="s2"
                format={(v) => `${Math.round(v)} min`}
                emptyMessage="No training logged this week"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Reading"
              icon="📖"
              subtitle={`${formatDuration(week.readingTotalMin)} total · ${week.pagesRead} pages`}
            />
            <div className="card-pad">
              <BarChart
                data={week.readingMinutes.map(label)}
                target={state.settings.readingGoalMin}
                targetLabel="daily goal"
                tone="s3"
                format={(v) => `${Math.round(v)} min`}
                emptyMessage="No reading logged this week"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Orthodox rule consistency"
              icon="✝️"
              subtitle={`${orthodoxAvg}% of the rule kept so far this week`}
            />
            <div className="card-pad">
              <BarChart
                data={week.orthodoxCompletion.map(label)}
                target={100}
                targetLabel="full rule"
                tone="s7"
                format={(v) => `${Math.round(v)}%`}
                emptyMessage="Nothing checked off this week"
              />
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Habit streaks" icon="🔥" />
            <ul className="divide-y divide-line">
              {habits.slice(0, 12).map((h) => {
                const s = habitStreak(state, h, weekStart);
                return (
                  <li key={h.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                      <span aria-hidden="true">{h.icon}</span> {h.name}
                    </span>
                    <WeekDots
                      days={week.dates.map((d) => ({
                        label: shortDay(d),
                        state: state.habitLogs.some(
                          (l) => l.habitId === h.id && l.date === d && l.done,
                        )
                          ? 'done'
                          : d > today()
                            ? 'future'
                            : 'missed',
                      }))}
                    />
                    <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
                      {s.current}d
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="School workload" icon="🎓" />
            <div className="card-pad space-y-3">
              <Progress
                value={week.schoolDone}
                max={Math.max(week.schoolDueThisWeek, 1)}
                label="Assignments due this week"
                hint={`${week.schoolDone}/${week.schoolDueThisWeek} done`}
              />
              <StatTile
                label="Work still owed"
                value={formatDuration(week.schoolLoadMin)}
                hint="Estimate minus what you have logged"
              />
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
                  Missed tasks
                </p>
                {missed.length ? (
                  <ul className="space-y-1">
                    {missed.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink-secondary">{t.title}</span>
                        <Badge tone="critical">⚠ {relativeDay(t.date!)}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">Nothing overdue. Well done.</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Coming up" icon="👥" subtitle="Next seven days" />
            {upcoming.length ? (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 8).map((m, i) => (
                  <li key={`${m.id}-${m.date}-${i}`} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-20 shrink-0 text-xs text-ink-muted">
                      {relativeDay(m.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                      {formatTime(m.startTime)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="Nothing scheduled in the next week." />
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Steps" icon="👟" />
            <div className="card-pad">
              <BarChart
                data={week.steps.map(label)}
                target={state.settings.stepGoal}
                height={72}
                format={(v) => Math.round(v).toLocaleString()}
                emptyMessage="No step data this week"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Water" icon="💧" />
            <div className="card-pad">
              <BarChart
                data={week.waterCups.map(label)}
                target={state.settings.waterGoalCups}
                tone="s3"
                height={72}
                format={(v) => `${Math.round(v)} cups`}
                emptyMessage="No water logged this week"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Diet" icon="🥗" />
            <div className="card-pad space-y-3">
              <Progress
                value={week.cleanMealRate}
                max={100}
                label="Meals on plan"
                hint={`${week.cleanMealRate}%`}
                tone={week.cleanMealRate >= 80 ? 'good' : 'brand'}
              />
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Avg calories" value={week.avgCalories} unit="kcal" />
                <StatTile label="Avg protein" value={week.avgProtein} unit="g" />
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Everything, day by day"
            icon="▥"
            subtitle="One row per day so a bad Tuesday is obvious."
          />
          <div className="scroll-x">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-4 py-2 font-medium">Sleep</th>
                  <th className="px-4 py-2 font-medium">Training</th>
                  <th className="px-4 py-2 font-medium">Reading</th>
                  <th className="px-4 py-2 font-medium">Steps</th>
                  <th className="px-4 py-2 font-medium">Water</th>
                  <th className="px-4 py-2 font-medium">Habits</th>
                  <th className="px-4 py-2 font-medium">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {week.dates.map((d, i) => (
                  <tr key={d} className={d === today() ? 'bg-brand/[0.05]' : undefined}>
                    <td className="px-4 py-2 font-medium text-ink">{shortDay(d)}</td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {week.sleepMinutes[i].value ? `${hours(week.sleepMinutes[i].value)}h` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {week.workoutMinutes[i].value ? `${week.workoutMinutes[i].value}m` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {week.readingMinutes[i].value ? `${week.readingMinutes[i].value}m` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {week.steps[i].value ? week.steps[i].value.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {week.waterCups[i].value || '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {d > today() ? '—' : `${week.habitCompletion[i].value}%`}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-secondary">
                      {orthodox.length && d <= today()
                        ? `${week.orthodoxCompletion[i].value}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
