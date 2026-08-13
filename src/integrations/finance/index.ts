import type { FinanceDigest } from '@/types';

/**
 * Same backend-less pattern as mail: Claude scans Gmail for money-related
 * signals (failed payments, low balance, unusual charges) on its own
 * schedule and commits this file. The app only ever reads it.
 */
export async function fetchFinanceDigest(): Promise<FinanceDigest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/finance.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as FinanceDigest;
  } catch {
    return null;
  }
}
