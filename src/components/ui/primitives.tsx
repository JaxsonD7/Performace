import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: As = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <As className={cx('card', className)}>{children}</As>;
}

export function CardHeader({
  title,
  icon,
  action,
  subtitle,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warning' | 'serious' | 'critical' | 'brand';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line text-ink-secondary',
    brand: 'border-brand/30 bg-brand/10 text-brand',
    good: 'border-good/30 bg-good/10 text-good',
    warning: 'border-warning/40 bg-warning/10 text-ink-secondary',
    serious: 'border-serious/40 bg-serious/10 text-ink-secondary',
    critical: 'border-critical/30 bg-critical/10 text-critical',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Checkbox({
  checked,
  onChange,
  label,
  sublabel,
  icon,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        'group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-raised',
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40',
          checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface',
        )}
      >
        {checked ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {icon ? (
        <span className="text-base leading-none" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate text-sm',
            checked ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {label}
        </span>
        {sublabel ? <span className="block truncate text-xs text-ink-muted">{sublabel}</span> : null}
      </span>
    </label>
  );
}

export function Progress({
  value,
  max = 100,
  label,
  hint,
  tone = 'brand',
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  hint?: ReactNode;
  tone?: 'brand' | 'good' | 'warning' | 'critical' | 's2' | 's3' | 's7';
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar: Record<string, string> = {
    brand: 'bg-brand',
    good: 'bg-good',
    warning: 'bg-warning',
    critical: 'bg-critical',
    s2: 'bg-s2',
    s3: 'bg-s3',
    s7: 'bg-s7',
  };
  return (
    <div>
      {label || hint ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate text-ink-secondary">{label}</span>
          <span className="shrink-0 tabular-nums text-ink-muted">{hint}</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', bar[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const GAUGE_TONE: Record<string, string> = {
  brand: 'rgb(var(--series-1))',
  good: 'rgb(var(--good))',
  warning: 'rgb(var(--warning))',
  critical: 'rgb(var(--critical))',
  s2: 'rgb(var(--series-2))',
  s3: 'rgb(var(--series-3))',
  s7: 'rgb(var(--series-7))',
};

/**
 * The instrument-panel version of `Progress` — an arc instead of a bar, for
 * the handful of hero stats that earn the extra visual weight (day
 * completion, a big weekly number). Most progress in the app stays a bar;
 * this is reserved for the one or two things per screen that should read
 * first.
 */
export function RadialGauge({
  value,
  max = 100,
  label,
  hint,
  tone = 'brand',
  size = 96,
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  hint?: ReactNode;
  tone?: 'brand' | 'good' | 'warning' | 'critical' | 's2' | 's3' | 's7';
  size?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const stroke = Math.max(4, size * 0.08);
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const color = GAUGE_TONE[tone] ?? GAUGE_TONE.brand;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={typeof label === 'string' ? label : undefined}
        >
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--gridline))" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 600ms ease',
              filter: `drop-shadow(0 0 calc(6px * var(--glow-strength)) ${color})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="hud-mono hud-glow text-lg font-semibold text-ink">{Math.round(pct)}%</span>
        </div>
      </div>
      {label || hint ? (
        <div className="text-center">
          {label ? <p className="text-xs font-medium text-ink-secondary">{label}</p> : null}
          {hint ? <p className="hud-mono text-[11px] text-ink-muted">{hint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('input min-h-[80px] resize-y', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('input', props.className)} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    // The outer element is block-level so it can never be wider than the page;
    // a long set of tabs scrolls horizontally inside it instead.
    <div className="scroll-x">
      <div className="inline-flex rounded-lg border border-line bg-raised p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cx(
              'whitespace-nowrap rounded-[6px] font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              value === o.value
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconButton({
  onClick,
  label,
  children,
  tone = 'quiet',
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  tone?: 'quiet' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        tone === 'danger'
          ? 'text-ink-muted hover:bg-critical/10 hover:text-critical'
          : 'text-ink-muted hover:bg-raised hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons — inline so the app ships with no icon dependency.
// ---------------------------------------------------------------------------

const iconProps = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-4 w-4',
};

export const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3.5 5.5h13M8 5.5V4h4v1.5M5.5 5.5l.8 10a1 1 0 001 .9h5.4a1 1 0 001-.9l.8-10" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...iconProps}>
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
);

export const ChevronLeft = () => (
  <svg {...iconProps}>
    <path d="M12 4l-5 6 5 6" />
  </svg>
);

export const ChevronRight = () => (
  <svg {...iconProps}>
    <path d="M8 4l5 6-5 6" />
  </svg>
);

export const SparkIcon = () => (
  <svg {...iconProps}>
    <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3z" />
  </svg>
);
