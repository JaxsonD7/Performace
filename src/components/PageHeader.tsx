import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-surface px-4 py-4 sm:px-6">
      {/* A faint diagonal energy trace instead of a flat rule — the header's
          own version of the card's cut corner, at architectural scale. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, rgb(var(--series-1) / 0.7) 0%, rgb(var(--series-1) / 0.25) 35%, rgb(var(--border) / 0.5) 70%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full opacity-[calc(0.5*var(--glow-strength))]"
        style={{ background: 'radial-gradient(circle, rgb(var(--series-1) / 0.35), transparent 70%)' }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 h-6 w-1 shrink-0 rounded-full"
            style={{
              background: 'rgb(var(--series-1))',
              boxShadow: '0 0 calc(10px * var(--glow-strength)) rgb(var(--series-1) / var(--glow-strength))',
            }}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="relative mt-3">{children}</div> : null}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">{children}</div>;
}
