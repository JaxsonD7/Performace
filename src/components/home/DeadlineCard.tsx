import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, IconButton } from '@/components/ui/primitives';
import { fetchDeadlineDigest } from '@/integrations/deadlines';
import { relativeDay, timeAgo } from '@/lib/date';
import { useStore } from '@/store/store';
import type { DeadlineDigest } from '@/types';

/** Same generated-outside-the-app pattern as Mail — Claude reads renewal/deadline emails out of Gmail and commits this file. */
export function DeadlineCard() {
  const { state, dismissDeadline } = useStore();
  const [digest, setDigest] = useState<DeadlineDigest | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchDeadlineDigest().then((d) => {
      if (!cancelled) setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = digest && digest !== 'loading'
    ? digest.items
        // Anything with a real due date is already living as a removable
        // task on the schedule — no need to also show it here.
        .filter((i) => !state.dismissedDeadlineIds.includes(i.id) && !state.autoScheduledDeadlineIds.includes(i.id))
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        })
    : [];

  const stale = digest && digest !== 'loading'
    ? Date.now() - new Date(digest.generatedAt).getTime() > 36 * 3600 * 1000
    : false;

  return (
    <Card>
      <CardHeader
        title="Deadlines"
        icon="⏰"
        subtitle={digest === 'loading' ? undefined : digest ? `checked ${timeAgo(digest.generatedAt)}` : 'Not scanned yet'}
        action={stale ? <Badge tone="warning">Stale</Badge> : null}
      />
      <div className="card-pad">
        {digest === 'loading' ? (
          <p className="py-4 text-center text-sm text-ink-muted">Loading…</p>
        ) : !digest ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            No digest yet — this fills in after the next overnight scan.
          </p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Nothing coming up.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((d) => (
              <li key={d.id} className="group flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-ink">{d.subject}</p>
                    {d.dueDate ? (
                      <span className="hud-mono shrink-0 text-xs text-ink-secondary">{relativeDay(d.dueDate)}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{d.from} · {timeAgo(d.receivedAt)}</p>
                  <p className="mt-1 text-xs text-ink-secondary">{d.reason}</p>
                </div>
                <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => dismissDeadline(d.id)} label="Dismiss">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
