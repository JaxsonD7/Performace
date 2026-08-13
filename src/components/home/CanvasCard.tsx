import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/primitives';
import { fetchCanvasDigest } from '@/integrations/canvas';
import { timeAgo } from '@/lib/date';
import type { CanvasDigest } from '@/types';

/**
 * Nothing feeds this yet — there's no school Gmail or Canvas API token
 * connected, so `canvas.json` doesn't exist and this card says so plainly
 * rather than sitting there looking broken or, worse, making something up.
 * Once either source exists, this starts rendering the same way Mail did
 * after its first scan.
 */
export function CanvasCard() {
  const [digest, setDigest] = useState<CanvasDigest | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchCanvasDigest().then((d) => {
      if (!cancelled) setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = digest && digest !== 'loading' ? digest.items : [];

  return (
    <Card>
      <CardHeader
        title="Canvas"
        icon="🎓"
        subtitle={digest && digest !== 'loading' ? `checked ${timeAgo(digest.generatedAt)}` : undefined}
      />
      <div className="card-pad">
        {digest === 'loading' ? (
          <p className="py-4 text-center text-sm text-ink-muted">Loading…</p>
        ) : !digest ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            Not connected — link your school Gmail, or share a Canvas API token, to turn this on.
          </p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Nothing new.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((c) => (
              <li key={c.id} className="py-2.5">
                <p className="truncate text-sm font-medium text-ink">{c.subject}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {c.courseName ? `${c.courseName} · ` : ''}
                  {timeAgo(c.receivedAt)}
                </p>
                <p className="mt-1 text-xs text-ink-secondary">{c.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
