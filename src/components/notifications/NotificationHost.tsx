import { useEffect, useRef } from 'react';
import { toMinutes, today } from '@/lib/date';
import { remindersForDay } from '@/integrations/notifications';
import { useStore } from '@/store/store';

/**
 * Schedules today's reminders as plain `setTimeout`s while this tab stays
 * open — there is no push server behind a static site, so anything fired
 * after the tab closes is out of scope. Re-plans whenever today's blocks or
 * the lead time change; a `tag` per block keeps a re-plan from double-firing
 * something that already went off.
 */
export function NotificationHost() {
  const { state } = useStore();
  const timers = useRef<number[]>([]);
  const fired = useRef<Set<string>>(new Set());

  const date = today();
  const enabled = state.settings.notificationsEnabled;
  const leadMin = state.settings.notificationLeadMin;
  const blockSignature = state.blocks
    .filter((b) => b.date === date)
    .map((b) => `${b.id}:${b.start}:${b.completed}`)
    .join(',');

  useEffect(() => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];

    if (!enabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const todaysBlocks = state.blocks.filter((b) => b.date === date);
    const reminders = remindersForDay(todaysBlocks, leadMin);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    reminders.forEach((r) => {
      const key = `${date}|${r.title}|${r.at}`;
      if (fired.current.has(key)) return;
      const fireAtMin = toMinutes(r.at) - leadMin;
      const delayMs = (fireAtMin - nowMin) * 60_000;
      if (delayMs <= 0 || delayMs > 20 * 3600 * 1000) return;

      const id = window.setTimeout(() => {
        fired.current.add(key);
        try {
          new Notification(r.title, { body: r.body, tag: key });
        } catch {
          // Notification constructor can throw on some mobile browsers even
          // with permission granted (e.g. requires a service worker there) —
          // a missed reminder is not worth surfacing an error over.
        }
      }, delayMs);
      timers.current.push(id);
    });

    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, leadMin, date, blockSignature]);

  return null;
}
