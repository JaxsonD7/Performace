import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, IconButton } from '@/components/ui/primitives';
import { fetchMailDigest } from '@/integrations/mail';
import { timeAgo } from '@/lib/date';
import { useStore } from '@/store/store';
import type { MailAccount, MailDigest } from '@/types';

const ACCOUNT_LABEL: Record<MailAccount, string> = { personal: 'Personal', school: 'School' };

/**
 * Nothing here is fetched live from Gmail — there is no in-app Google
 * connection at all. Claude reads the inbox on its own schedule and commits
 * the result as a static file; this just displays whatever that file said
 * last, which is why "last checked" matters more here than on any other card.
 */
export function MailCard() {
  const { state, dismissMail } = useStore();
  const [digest, setDigest] = useState<MailDigest | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchMailDigest().then((d) => {
      if (!cancelled) setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = digest && digest !== 'loading'
    ? digest.emails
        .filter((e) => !state.dismissedMailIds.includes(e.id))
        .sort((a, b) => {
          if (a.importance !== b.importance) return a.importance === 'high' ? -1 : 1;
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        })
    : [];

  const stale = digest && digest !== 'loading'
    ? Date.now() - new Date(digest.generatedAt).getTime() > 36 * 3600 * 1000
    : false;

  return (
    <Card>
      <CardHeader
        title="Mail"
        icon="✉️"
        subtitle={
          digest === 'loading'
            ? undefined
            : digest
              ? `${ACCOUNT_LABEL[digest.accounts[0]] ?? digest.accounts.join(', ')}${digest.accounts.length > 1 ? ` + ${digest.accounts.length - 1} more` : ''} · checked ${timeAgo(digest.generatedAt)}`
              : 'Not scanned yet'
        }
        action={stale ? <Badge tone="warning">Stale</Badge> : null}
      />
      <div className="card-pad">
        {digest === 'loading' ? (
          <p className="py-4 text-center text-sm text-ink-muted">Loading…</p>
        ) : !digest ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            No digest yet — this fills in after the first overnight scan.
          </p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Nothing important right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((m) => (
              <li key={m.id} className="group flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {m.importance === 'high' ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-critical" aria-hidden="true" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-s4" aria-hidden="true" />
                    )}
                    <p className="truncate text-sm font-medium text-ink">{m.subject}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {m.from} · {timeAgo(m.receivedAt)}
                    {digest.accounts.length > 1 ? ` · ${ACCOUNT_LABEL[m.account]}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-secondary">{m.reason}</p>
                </div>
                <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => dismissMail(m.id)} label="Dismiss">
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
