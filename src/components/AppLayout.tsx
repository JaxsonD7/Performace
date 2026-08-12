import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { cx } from '@/components/ui/primitives';
import { dayScore } from '@/lib/metrics';
import { formatDate, today } from '@/lib/date';
import { useStore, type SyncStatus } from '@/store/store';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: '⌂' },
  { to: '/', label: 'Today', icon: '◎', end: true },
  { to: '/schedule', label: 'Schedule', icon: '▤' },
  { to: '/school', label: 'School & Tasks', icon: '✎' },
  { to: '/health', label: 'Health & Gym', icon: '❤' },
  { to: '/reading', label: 'Reading', icon: '❏' },
  { to: '/goals', label: 'Goals & Rule', icon: '✦' },
  { to: '/metrics', label: 'Metrics', icon: '▥' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

/** The five that matter on a phone; the rest live behind "More". */
const MOBILE_NAV_LABELS = ['Home', 'Today', 'Schedule', 'School & Tasks', 'Goals & Rule'];
const MOBILE_NAV = MOBILE_NAV_LABELS.map((label) => NAV.find((n) => n.label === label)!);

export function AppLayout() {
  const { state, sync } = useStore();
  const [drawer, setDrawer] = useState(false);
  const score = dayScore(state, today());

  return (
    <div className="min-h-full lg:flex">
      {/* --- Desktop sidebar --- */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
        <Brand score={score.pct} />
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <Footprint sync={sync} />
      </aside>

      {/* --- Mobile top bar --- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-sm font-semibold text-ink">Performace</p>
          <p className="text-xs text-ink-muted">{formatDate(today(), { month: 'short', day: 'numeric', weekday: 'short' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings" aria-label="Sync status" className="shrink-0">
            <SyncDot sync={sync} />
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDrawer((d) => !d)}
            aria-expanded={drawer}
          >
            {drawer ? 'Close' : 'More'}
          </button>
        </div>
      </header>

      {drawer ? (
        <div className="border-b border-line bg-surface px-3 py-2 lg:hidden">
          <nav className="grid grid-cols-2 gap-1">
            {NAV.map((item) => (
              <SideLink key={item.to} item={item} onNavigate={() => setDrawer(false)} />
            ))}
          </nav>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* --- Mobile bottom nav --- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-brand' : 'text-ink-muted',
              )
            }
          >
            <span className="text-base leading-none" aria-hidden="true">
              {item.icon}
            </span>
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SideLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'relative flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'text-brand' : 'text-ink-secondary hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* A slanted accent bar instead of a filled pill — the same "cut"
              language as the cards, at nav-item scale. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 left-0 w-1 transition-opacity"
            style={{
              background: 'rgb(var(--series-1))',
              clipPath: 'polygon(0 20%, 100% 0, 100% 100%, 0 80%)',
              opacity: isActive ? 1 : 0,
              boxShadow: isActive
                ? '0 0 calc(8px * var(--glow-strength)) rgb(var(--series-1) / var(--glow-strength))'
                : 'none',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 transition-opacity"
            style={{
              background: 'linear-gradient(90deg, rgb(var(--series-1) / 0.1), transparent 75%)',
              opacity: isActive ? 1 : 0,
            }}
          />
          <span className="relative w-4 text-center text-base leading-none" aria-hidden="true">
            {item.icon}
          </span>
          <span className="relative truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function Brand({ score }: { score: number }) {
  return (
    <div className="relative overflow-hidden px-5 py-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, rgb(var(--series-1) / 0.6), rgb(var(--border) / 0.4) 60%, transparent)',
        }}
      />
      <p className="hud-mono text-base font-semibold tracking-[0.08em] text-ink">PERFORMACE</p>
      <p className="mt-0.5 text-xs text-ink-muted">{formatDate(today())}</p>
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-ink-secondary">Today</span>
          <span className="hud-mono font-semibold text-ink">{score}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ boxShadow: '0 0 6px calc(1px * var(--glow-strength)) rgb(var(--series-1) / var(--glow-strength))', width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SyncDot({ sync }: { sync: SyncStatus }) {
  if (!sync.connected) {
    return <span className="h-2 w-2 rounded-full bg-ink-muted" aria-hidden="true" title="Not syncing" />;
  }
  if (sync.state === 'error') {
    return <span className="h-2 w-2 rounded-full bg-critical" aria-hidden="true" title="Sync error" />;
  }
  if (sync.state === 'syncing') {
    return <span className="h-2 w-2 animate-pulse rounded-full bg-s1" aria-hidden="true" title="Syncing" />;
  }
  return (
    <span
      className="h-2 w-2 rounded-full bg-good"
      style={{ boxShadow: '0 0 5px calc(1px * var(--glow-strength)) rgb(var(--good) / var(--glow-strength))' }}
      aria-hidden="true"
      title="Synced"
    />
  );
}

function Footprint({ sync }: { sync: SyncStatus }) {
  return (
    <div className="border-t border-line px-5 py-3">
      {!sync.connected ? (
        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-[11px] leading-relaxed text-ink-muted transition-colors hover:text-brand"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" aria-hidden="true" />
          <span>This device isn't syncing — connect it →</span>
        </Link>
      ) : sync.state === 'error' ? (
        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-[11px] leading-relaxed text-critical hover:underline"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-critical" aria-hidden="true" />
          <span>Sync error — check Settings</span>
        </Link>
      ) : sync.state === 'syncing' ? (
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-ink-muted">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-s1" aria-hidden="true" />
          <span>Syncing…</span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-ink-muted">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-good"
            style={{ boxShadow: '0 0 5px calc(1px * var(--glow-strength)) rgb(var(--good) / var(--glow-strength))' }}
            aria-hidden="true"
          />
          <span>
            Synced{sync.lastSyncedAt ? ` · ${new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
          </span>
        </p>
      )}
    </div>
  );
}
