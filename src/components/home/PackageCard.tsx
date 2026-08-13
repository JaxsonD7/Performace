import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, IconButton } from '@/components/ui/primitives';
import { fetchPackageDigest } from '@/integrations/packages';
import { relativeDay, timeAgo } from '@/lib/date';
import { useStore } from '@/store/store';
import type { PackageDigest, PackageStatus } from '@/types';

const STATUS_LABEL: Record<PackageStatus, string> = {
  ordered: 'Ordered',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delayed: 'Delayed',
  unknown: 'Tracking',
};

/** Same generated-outside-the-app pattern as Mail — Claude reads shipping/tracking emails out of Gmail and commits this file. */
export function PackageCard() {
  const { state, dismissPackage } = useStore();
  const [digest, setDigest] = useState<PackageDigest | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchPackageDigest().then((d) => {
      if (!cancelled) setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = digest && digest !== 'loading'
    ? digest.items
        .filter((i) => !state.dismissedPackageIds.includes(i.id) && i.status !== 'delivered')
        .sort((a, b) => {
          if (a.estimatedDate && b.estimatedDate) return a.estimatedDate.localeCompare(b.estimatedDate);
          if (a.estimatedDate) return -1;
          if (b.estimatedDate) return 1;
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        })
    : [];

  const stale = digest && digest !== 'loading'
    ? Date.now() - new Date(digest.generatedAt).getTime() > 36 * 3600 * 1000
    : false;

  return (
    <Card>
      <CardHeader
        title="Packages"
        icon="📦"
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
          <p className="py-4 text-center text-sm text-ink-muted">Nothing in transit.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((p) => (
              <li key={p.id} className="group flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-ink">{p.merchant ?? p.subject}</p>
                    <span className="hud-mono shrink-0 text-[10px] uppercase tracking-wide text-ink-secondary">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {p.carrier ? `${p.carrier} · ` : ''}
                    {p.estimatedDate ? `arriving ${relativeDay(p.estimatedDate)}` : timeAgo(p.receivedAt)}
                  </p>
                </div>
                <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => dismissPackage(p.id)} label="Dismiss">
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
