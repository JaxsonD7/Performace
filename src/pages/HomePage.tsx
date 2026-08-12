import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { MailCard } from '@/components/home/MailCard';
import { Card, RadialGauge, cx } from '@/components/ui/primitives';
import { formatDate, startOfWeek, today } from '@/lib/date';
import { bodyGoalProgress, liftGoalProgress } from '@/lib/goals';
import { dayScore, weekSummary } from '@/lib/metrics';
import { selectDay } from '@/lib/selectors';
import { useStore } from '@/store/store';

/**
 * Today is the working surface — every card, every "+", every checkbox.
 * Home is the opposite: nothing to do here, just a fast read on how things
 * are actually going. Laid out as an asymmetric bento grid rather than a row
 * of equal tiles on purpose — one hero reading (today) anchors the corner,
 * everything else is sized by how much it matters, not forced into a
 * uniform row/column rhythm.
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
  const activeHabitCount = state.habits.filter((h) => !h.archived).length;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6 sm:[grid-auto-rows:minmax(0,1fr)]">
          <HeroGauge
            className="col-span-2 sm:col-span-3 sm:row-span-2"
            label="Today"
            value={score.pct}
            hint={`${score.done} of ${score.total} kept`}
          />
          <MiniGauge
            className="col-span-1 sm:col-span-2"
            label="Workouts this week"
            value={Math.round((week.workoutsCompleted / workoutTarget) * 100)}
            hint={`${week.workoutsCompleted}/${workoutTarget}`}
            tone="s2"
          />
          <MiniGauge
            className="col-span-1"
            label="Water"
            value={Math.round((day.day.waterOz / s.waterGoalOz) * 100)}
            hint={`${day.day.waterOz}/${s.waterGoalOz} oz`}
            tone="s3"
          />
          <MiniStat
            className="col-span-1 sm:col-span-2"
            icon="⚖️"
            label="Weight"
            value={bodyProgress ? Math.round(bodyProgress.current).toString() : '—'}
            unit={s.weightUnit}
            hint={
              activeBodyGoal
                ? `→ ${activeBodyGoal.targetWeight} ${s.weightUnit}`
                : 'no active goal'
            }
          />
          <MiniGauge
            className="col-span-1"
            label="Habits"
            value={habitRateToday}
            hint={`${Math.round((habitRateToday / 100) * activeHabitCount)}/${activeHabitCount}`}
            tone="s7"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <div className="card-pad flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-secondary">📖 Reading this week</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="hud-mono text-2xl font-semibold text-ink">{week.readingTotalMin}</span>
                  <span className="text-xs text-ink-secondary">min</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{week.pagesRead} pages</p>
              </div>
              <MiniRing pct={Math.min(100, Math.round((week.readingTotalMin / (s.readingGoalMin * 7 || 1)) * 100))} tone="s3" />
            </div>
          </Card>
          <Card>
            <div className="card-pad flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-secondary">🥗 Diet on plan</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="hud-mono text-2xl font-semibold text-ink">{week.cleanMealRate}</span>
                  <span className="text-xs text-ink-secondary">%</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {week.avgCalories} kcal · {week.avgProtein}g protein avg
                </p>
              </div>
              <MiniRing pct={week.cleanMealRate} tone={week.cleanMealRate >= 80 ? 'good' : 'brand'} />
            </div>
          </Card>
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

const GAUGE_COLOR: Record<string, string> = {
  brand: 'rgb(var(--series-1))',
  good: 'rgb(var(--good))',
  s2: 'rgb(var(--series-2))',
  s3: 'rgb(var(--series-3))',
  s7: 'rgb(var(--series-7))',
};

/** The one large reading on the page — everything else is sized beneath it. */
function HeroGauge({
  className,
  label,
  value,
  hint,
}: {
  className?: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className={cx('card relative flex flex-col items-center justify-center gap-3 overflow-hidden p-6', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[calc(0.5*var(--glow-strength))]"
        style={{ background: 'radial-gradient(circle at 50% 40%, rgb(var(--series-1) / 0.18), transparent 65%)' }}
      />
      <RadialGauge value={Number.isFinite(value) ? value : 0} tone="brand" size={148} />
      <div className="relative text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">{label}</p>
        <p className="hud-mono mt-0.5 text-xs text-ink-muted">{hint}</p>
      </div>
    </div>
  );
}

function MiniGauge({
  className,
  label,
  value,
  hint,
  tone,
}: {
  className?: string;
  label: string;
  value: number;
  hint: string;
  tone: 'brand' | 'good' | 'warning' | 'critical' | 's2' | 's3' | 's7';
}) {
  return (
    <div className={cx('card flex min-h-[104px] flex-col items-center justify-center gap-1.5 p-3', className)}>
      <RadialGauge value={Number.isFinite(value) ? value : 0} tone={tone} size={56} />
      <div className="text-center">
        <p className="truncate text-[11px] font-medium text-ink-secondary">{label}</p>
        <p className="hud-mono text-[10px] text-ink-muted">{hint}</p>
      </div>
    </div>
  );
}

function MiniStat({
  className,
  icon,
  label,
  value,
  unit,
  hint,
}: {
  className?: string;
  icon: string;
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className={cx('card flex min-h-[104px] flex-col justify-center gap-0.5 p-3', className)}>
      <p className="text-[11px] font-medium text-ink-secondary">
        <span aria-hidden="true">{icon}</span> {label}
      </p>
      <p className="hud-mono flex items-baseline gap-1 text-xl font-semibold text-ink">
        {value}
        <span className="text-[10px] font-normal text-ink-secondary">{unit}</span>
      </p>
      <p className="truncate text-[10px] text-ink-muted">{hint}</p>
    </div>
  );
}

/** A small unlabeled ring for a secondary reading beside a hero number. */
function MiniRing({ pct, tone }: { pct: number; tone: 'brand' | 'good' | 's2' | 's3' | 's7' }) {
  const size = 48;
  const stroke = 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--gridline))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={GAUGE_COLOR[tone] ?? GAUGE_COLOR.brand}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped / 100)}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}
