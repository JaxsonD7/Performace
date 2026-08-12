import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { MailCard } from '@/components/home/MailCard';
import { Card, RadialGauge, cx } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/charts';
import { formatDate, startOfWeek, today } from '@/lib/date';
import { bodyGoalProgress, liftGoalProgress } from '@/lib/goals';
import { dayScore, weekSummary } from '@/lib/metrics';
import { selectDay } from '@/lib/selectors';
import { useStore } from '@/store/store';

/**
 * Today is the working surface — every card, every "+", every checkbox.
 * Home is the opposite: nothing to do here, just a fast read on how things
 * are actually going. If a card would make you think, it belongs on Today.
 */
export function HomePage() {
  const { state } = useStore();
  const date = today();
  const weekStart = startOfWeek(date, state.settings.weekStartsOn);
  const score = dayScore(state, date);
  const week = weekSummary(state, weekStart);
  const day = selectDay(state, date);
  const s = state.settings;

  const activeBodyGoal = state.bodyGoals.find((g) => g.active);
  const bodyProgress = activeBodyGoal ? bodyGoalProgress(state, activeBodyGoal) : null;
  const activeLiftGoals = state.liftGoals.filter((g) => g.active);

  const habitRateToday = week.habitCompletion.find((p) => p.date === date)?.value ?? 0;
  const workoutTarget = s.workoutsPerWeekGoal || week.workoutsPlanned || 1;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <GaugeCard label="Today" value={score.pct} hint={`${score.done}/${score.total}`} tone="brand" />
          <GaugeCard
            label="Workouts this week"
            value={Math.round((week.workoutsCompleted / workoutTarget) * 100)}
            hint={`${week.workoutsCompleted}/${workoutTarget}`}
            tone="s2"
          />
          <GaugeCard
            label="Water today"
            value={Math.round((day.day.waterOz / s.waterGoalOz) * 100)}
            hint={`${day.day.waterOz}/${s.waterGoalOz} oz`}
            tone="s3"
          />
          <GaugeCard
            label="Habits today"
            value={habitRateToday}
            hint={`${Math.round((habitRateToday / 100) * (state.habits.filter((h) => !h.archived).length || 0))} kept`}
            tone="s7"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Weight"
            icon="⚖️"
            value={bodyProgress ? Math.round(bodyProgress.current) : '—'}
            unit={s.weightUnit}
            delta={
              activeBodyGoal && bodyProgress
                ? {
                    value: `${Math.abs(bodyProgress.current - activeBodyGoal.startWeight).toFixed(1)} ${s.weightUnit}`,
                    direction:
                      bodyProgress.current === activeBodyGoal.startWeight
                        ? 'flat'
                        : bodyProgress.current > activeBodyGoal.startWeight
                          ? 'up'
                          : 'down',
                    good:
                      bodyProgress.current === activeBodyGoal.startWeight
                        ? undefined
                        : activeBodyGoal.targetWeight > activeBodyGoal.startWeight
                          ? bodyProgress.current > activeBodyGoal.startWeight
                          : bodyProgress.current < activeBodyGoal.startWeight,
                  }
                : undefined
            }
            hint={
              activeBodyGoal
                ? `${activeBodyGoal.label} → ${activeBodyGoal.targetWeight} ${s.weightUnit}${activeBodyGoal.targetDate ? ` by ${formatDate(activeBodyGoal.targetDate, { month: 'short', day: 'numeric' })}` : ''}`
                : 'No active goal — set one on Goals & Rule'
            }
          />
          <StatTile
            label="Reading this week"
            icon="📖"
            value={week.readingTotalMin}
            unit="min"
            hint={`${week.pagesRead} pages`}
          />
          <StatTile
            label="Diet on plan"
            icon="🥗"
            value={week.cleanMealRate}
            unit="%"
            hint={`${week.avgCalories} kcal · ${week.avgProtein}g protein avg`}
            tone={week.cleanMealRate >= 80 ? 'good' : 'default'}
          />
        </div>

        {activeLiftGoals.length ? (
          <Card>
            <div className="card-pad">
              <p className="section-title mb-3">Lift goals</p>
              <div className="space-y-3">
                {activeLiftGoals.map((g) => {
                  const p = liftGoalProgress(state, g);
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="text-ink-secondary">{g.label ?? g.exerciseName}</span>
                        <span className="hud-mono text-ink-muted">
                          {Math.round(p.current)} → {g.targetWeight} {s.weightUnit}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
                        <div
                          className={cx(
                            'h-full rounded-full transition-[width] duration-500',
                            p.onTrack === false ? 'bg-warning' : 'bg-s1',
                          )}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link to="/goals" className="mt-3 inline-block text-xs text-brand">
                Manage goals →
              </Link>
            </div>
          </Card>
        ) : null}

        <MailCard />
      </PageBody>
    </>
  );
}

function GaugeCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'brand' | 'good' | 'warning' | 'critical' | 's2' | 's3' | 's7';
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 p-4">
        <RadialGauge value={Number.isFinite(value) ? value : 0} tone={tone} size={72} />
        <div className="text-center">
          <p className="text-xs font-medium text-ink-secondary">{label}</p>
          <p className="hud-mono text-[11px] text-ink-muted">{hint}</p>
        </div>
      </div>
    </Card>
  );
}
