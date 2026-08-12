import { useEffect, useRef, useState } from 'react';

/**
 * A floating countdown that starts when you finish a set. It lives at the app
 * level (mounted once in AppLayout) rather than per-card, so starting a timer
 * from one exercise doesn't get unmounted by scrolling — and so two timers can
 * never run at once, which matches how rest actually works.
 */

let starter: (seconds: number, label: string) => void = () => {};

export function startRestTimer(seconds: number, label: string): void {
  starter(seconds, label);
}

export function RestTimerHost() {
  const [state, setState] = useState<{ total: number; remaining: number; label: string } | null>(
    null,
  );
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    starter = (seconds, label) => {
      setState({ total: seconds, remaining: seconds, label });
    };
    return () => {
      starter = () => {};
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.remaining <= 0) {
      // A short vibration is the closest thing to a "done" chime that needs no
      // permission prompt and works with the screen off on a phone.
      if ('vibrate' in navigator) navigator.vibrate([120, 80, 120]);
      return;
    }
    intervalRef.current = window.setTimeout(() => {
      setState((s) => (s ? { ...s, remaining: s.remaining - 1 } : s));
    }, 1000);
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [state]);

  if (!state) return null;

  const mm = Math.floor(Math.max(0, state.remaining) / 60);
  const ss = Math.max(0, state.remaining) % 60;
  const pct = Math.max(0, Math.min(100, (state.remaining / state.total) * 100));
  const done = state.remaining <= 0;

  return (
    <div
      role="timer"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto
                 flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3
                 shadow-lg lg:bottom-4 lg:left-4 lg:right-auto lg:mx-0"
    >
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
          <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(var(--gridline))" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke={done ? 'rgb(var(--good))' : 'rgb(var(--series-2))'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 17}
            strokeDashoffset={2 * Math.PI * 17 * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-ink">
          {done ? '✓' : `${mm}:${String(ss).padStart(2, '0')}`}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{done ? 'Rest done' : 'Resting'}</p>
        <p className="truncate text-xs text-ink-muted">{state.label}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        {!done ? (
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs"
            onClick={() => setState((s) => (s ? { ...s, remaining: s.remaining + 30, total: s.total + 30 } : s))}
          >
            +30s
          </button>
        ) : null}
        <button type="button" className="btn-quiet !px-2 !py-1 text-xs" onClick={() => setState(null)}>
          {done ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
