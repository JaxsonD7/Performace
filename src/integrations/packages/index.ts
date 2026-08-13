import type { PackageDigest } from '@/types';

/** Same backend-less pattern as mail — shipping/tracking emails, triaged and committed by Claude on a schedule. */
export async function fetchPackageDigest(): Promise<PackageDigest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/packages.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PackageDigest;
  } catch {
    return null;
  }
}
