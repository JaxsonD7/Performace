import type { ScheduleBlock } from '@/types';
import { toMinutes } from '@/lib/date';

/**
 * The seam for reminders.
 *
 * Browser notifications need permission and only fire while a tab is open, so
 * this stays opt-in and unwired until it is actually wanted. The shape below is
 * what a scheduler would consume; swapping in a service worker (or a native
 * shell's notification API) means reimplementing `schedule` alone.
 */
export interface Reminder {
  at: string;
  title: string;
  body?: string;
}

export function remindersForDay(blocks: ScheduleBlock[], leadMinutes = 5): Reminder[] {
  return blocks
    .filter((b) => !b.completed)
    .map((b) => ({
      at: b.start,
      title: b.title,
      body: `Starts in ${leadMinutes} minutes`,
    }))
    .sort((a, b) => toMinutes(a.at) - toMinutes(b.at));
}

export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
