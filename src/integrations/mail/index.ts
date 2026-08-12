import type { MailDigest } from '@/types';

/**
 * There is no in-app Gmail connection at all — Claude reads the inbox on a
 * schedule (outside the app, using its own Gmail access), triages what's
 * worth surfacing, and commits the result as a static file in this repo.
 * The app's only job is to fetch that file, same as any other static asset.
 */
export async function fetchMailDigest(): Promise<MailDigest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/mail.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as MailDigest;
  } catch {
    return null;
  }
}
