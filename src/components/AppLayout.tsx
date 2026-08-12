import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cx } from '@/components/ui/primitives';
import { dayScore } from '@/lib/metrics';
import { formatDate, today } from '@/lib/date';
import { useStore } from '@/store/store';

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
  const { state } = useStore();
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
        <Footprint />
      </aside>

      {/* --- Mobile top bar --- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-sm font-semibold text-ink">Performace</p>
          <p className="text-xs text-ink-muted">{formatDate(today(), { month: 'short', day: 'numeric', weekday: 'short' })}</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setDrawer((d) => !d)}
          aria-expanded={drawer}
        >
          {drawer ? 'Close' : 'More'}
        </button>
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
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-brand/10 text-brand' : 'text-ink-secondary hover:bg-raised hover:text-ink',
        )
      }
    >
      <span className="w-4 text-center text-base leading-none" aria-hidden="true">
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function Brand({ score }: { score: number }) {
  return (
    <div className="border-b border-line px-5 py-4">
      <p className="text-base font-semibold tracking-tight text-ink">Performace</p>
      <p className="mt-0.5 text-xs text-ink-muted">{formatDate(today())}</p>
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-ink-secondary">Today</span>
          <span className="font-semibold tabular-nums text-ink">{score}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Footprint() {
  return (
    <div className="border-t border-line px-5 py-3">
      <p className="text-[11px] leading-relaxed text-ink-muted">
        Local-first — everything stays in this browser.
      </p>
    </div>
  );
}
