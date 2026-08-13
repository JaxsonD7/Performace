import type { DeadlineDigest } from '@/types';

/** Same backend-less pattern as mail — renewal/deadline emails, triaged and committed by Claude on a schedule. */
export async function fetchDeadlineDigest(): Promise<DeadlineDigest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/deadlines.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as DeadlineDigest;
  } catch {
    return null;
  }
}
