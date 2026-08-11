import { useState, type ReactNode } from 'react';
import { cx } from '@/components/ui/primitives';

/**
 * Small, dependency-free chart primitives.
 *
 * Deliberate choices: one series per chart (so the title names it and no legend
 * is needed), bars anchored to the baseline with 4px rounded data-ends and a 2px
 * surface gap, recessive gridlines, and a hover tooltip on every mark. Values
 * are never printed on every bar — only the hovered one, plus an optional
 * direct label on the extreme.
 */

export interface Point {
  label: string;
  value: number;
  /** Optional secondary line for the tooltip ("Tue, Mar 4"). */
  caption?: string;
  /** Marks the bar as the current day. */
  highlight?: boolean;
}

const TONES = {
  brand: 'bg-s1',
  s2: 'bg-s2',
  s3: 'bg-s3',
  s4: 'bg-s4',
  s7: 'bg-s7',
  good: 'bg-good',
} as const;

export function BarChart({
  data,
  height = 96,
  target,
  targetLabel,
  tone = 'brand',
  format = (v) => String(Math.round(v)),
  emptyMessage = 'No data yet',
}: {
  data: Point[];
  height?: number;
  target?: number;
  targetLabel?: string;
  tone?: keyof typeof TONES;
  format?: (v: number) => string;
  emptyMessage?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-muted"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const active = hover === null ? null : data[hover];

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Recessive gridline at the target, so "am I hitting it?" is one glance. */}
        {target ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-grid"
            style={{ bottom: `${(target / max) * 100}%` }}
          >
            {targetLabel ? (
              <span className="absolute -top-4 right-0 text-[10px] text-ink-muted">
                {targetLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex h-full items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="img"
              aria-label={`${d.label}: ${format(d.value)}`}
            >
              <div
                className={cx(
                  'w-full rounded-t-[4px] transition-opacity',
                  TONES[tone],
                  d.value === 0 && 'bg-grid',
                  hover !== null && hover !== i && 'opacity-40',
                  d.highlight && 'ring-2 ring-inset ring-surface',
                )}
                style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 1.5)}%` }}
              />
            </div>
          ))}
        </div>

        {active ? (
          <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-card">
            <span className="font-semibold tabular-nums text-ink">{format(active.value)}</span>
            <span className="ml-1.5 text-ink-muted">{active.caption ?? active.label}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1">
        {data.map((d, i) => (
          <div
            key={`${d.label}-label-${i}`}
            className={cx(
              'flex-1 text-center text-[10px]',
              d.highlight ? 'font-semibold text-ink-secondary' : 'text-ink-muted',
            )}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A hero number with its own context. Not a chart — when the answer is one
 * value, a tile reads faster than any plot.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  delta,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  /** Signed change; the arrow and word carry the meaning, not the color. */
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; good?: boolean };
  icon?: ReactNode;
  tone?: 'default' | 'good' | 'warning' | 'critical';
}) {
  const ring: Record<string, string> = {
    default: 'border-line',
    good: 'border-good/30',
    warning: 'border-warning/40',
    critical: 'border-critical/30',
  };
  return (
    <div className={cx('rounded-xl border bg-surface p-3.5 shadow-card', ring[tone])}>
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
        {unit ? <span className="text-xs text-ink-secondary">{unit}</span> : null}
      </div>
      {delta ? (
        <div
          className={cx(
            'mt-1 inline-flex items-center gap-1 text-xs',
            delta.good === undefined ? 'text-ink-secondary' : delta.good ? 'text-good' : 'text-critical',
          )}
        >
          <span aria-hidden="true">
            {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '■'}
          </span>
          <span className="tabular-nums">{delta.value}</span>
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-xs text-ink-muted">{hint}</div> : null}
    </div>
  );
}

/** Seven dots for a habit week — done, missed, or not yet arrived. */
export function WeekDots({
  days,
}: {
  days: { label: string; state: 'done' | 'missed' | 'future' }[];
}) {
  return (
    <div className="flex gap-1" role="list">
      {days.map((d, i) => (
        <span
          key={`${d.label}-${i}`}
          role="listitem"
          title={`${d.label}: ${d.state}`}
          className={cx(
            'flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-semibold uppercase',
            d.state === 'done' && 'bg-s1 text-white',
            d.state === 'missed' && 'border border-line bg-raised text-ink-muted',
            d.state === 'future' && 'border border-dashed border-line text-ink-muted',
          )}
        >
          {d.label.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}
