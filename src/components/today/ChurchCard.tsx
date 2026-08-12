import { Card, CardHeader } from '@/components/ui/primitives';
import { diffDays, relativeDay } from '@/lib/date';
import { fastingStatus, feastsOn, nextGreatFeast } from '@/lib/orthodoxCalendar';
import { useStore } from '@/store/store';
import type { ISODate } from '@/types';

/**
 * What today actually calls for, computed from the real liturgical calendar
 * rather than a hardcoded Wednesday/Friday guess — see
 * `src/lib/orthodoxCalendar.ts`.
 */
export function ChurchCard({ date }: { date: ISODate }) {
  const { state } = useStore();
  const calendar = state.settings.orthodoxCalendar;
  const today = feastsOn(date, calendar);
  const fasting = fastingStatus(date, calendar);
  const upcoming = nextGreatFeast(date, calendar);

  return (
    <Card>
      <CardHeader title="Today in the Church" icon="⛪" />
      <div className="card-pad space-y-3">
        {today.length ? (
          <div className="rounded-lg bg-brand/10 px-3 py-2">
            <p className="text-sm font-medium text-brand">
              {today.map((f) => f.name).join(' · ')}
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
            style={{ background: fasting.fasting ? 'rgb(var(--series-4) / 0.15)' : 'rgb(var(--good) / 0.12)' }}
            aria-hidden="true"
          >
            {fasting.fasting ? '🍞' : '✓'}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {fasting.fasting ? 'Fasting day' : 'No fast today'}
            </p>
            {fasting.label ? <p className="text-xs text-ink-muted">{fasting.label}</p> : null}
          </div>
        </div>

        {upcoming ? (
          <div className="border-t border-line pt-3 text-xs text-ink-muted">
            Next: <span className="text-ink-secondary">{upcoming.name}</span> — {relativeDay(upcoming.date)}
            {diffDays(upcoming.date, date) > 6 ? ` (${diffDays(upcoming.date, date)} days)` : ''}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
