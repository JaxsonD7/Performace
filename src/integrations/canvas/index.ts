import type { CanvasDigest } from '@/types';

/**
 * No source feeds this file yet — there is no school Gmail or Canvas API
 * token connected. A 404 here just means "not turned on," same as mail.json
 * did before its first scan; the card reads that as an honest empty state
 * rather than treating it as an error.
 */
export async function fetchCanvasDigest(): Promise<CanvasDigest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/canvas.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as CanvasDigest;
  } catch {
    return null;
  }
}
