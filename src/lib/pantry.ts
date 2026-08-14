import type { PantryItem } from '@/types';

/** Items at or below their own threshold — unset threshold means "never flag this one." */
export function runningLow(items: PantryItem[]): PantryItem[] {
  return items
    .filter((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold)
    .sort((a, b) => a.name.localeCompare(b.name));
}
