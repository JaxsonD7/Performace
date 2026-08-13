import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, IconButton } from '@/components/ui/primitives';
import { fetchFinanceDigest } from '@/integrations/finance';
import { timeAgo } from '@/lib/date';
import { useStore } from '@/store/store';
import type { FinanceDigest, FinanceSeverity } from '@/types';

const SEVERITY_RANK: Record<FinanceSeverity, number> = { critical: 0, warning: 1, info: 2 };
const SEVERITY_DOT: Record<FinanceSeverity, string> = { critical: 'bg-critical', warning: 'bg-warning', info: 'bg-s4' };

/** Same generated-outside-the-app pattern as Mail — Claude reads bank/subscription signals out of Gmail and commits this file. */
export function FinanceCard() {
  const { state, dismissFinance } = useStore();
  const [digest, setDigest] = useState<FinanceDigest | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchFinanceDigest().then((d) => {
      if (!cancelled) setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = digest && digest !== 'loading'
    ? digest.items
        .filter((i) => !state.dismissedFinanceIds.includes(i.id))
        .sort((a, b) => {
          if (a.severity !== b.severity) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        })
    : [];

  const stale = digest && digest !== 'loading'
    ? Date.now() - new Date(digest.generatedAt).getTime() > 36 * 3600 * 1000
    : false;

  return (
    <Card>
      <CardHeader
        title="Money"
        icon="💳"
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
          <p className="py-4 text-center text-sm text-ink-muted">Nothing flagged right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((f) => (
              <li key={f.id} className="group flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`} aria-hidden="true" />
                    <p className="truncate text-sm font-medium text-ink">{f.merchant ?? f.subject}</p>
                    {f.amount != null ? (
                      <span className="hud-mono shrink-0 text-xs text-ink-secondary">${f.amount.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{f.from} · {timeAgo(f.receivedAt)}</p>
                  <p className="mt-1 text-xs text-ink-secondary">{f.reason}</p>
                </div>
                <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => dismissFinance(f.id)} label="Dismiss">
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
