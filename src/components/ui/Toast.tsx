import { useEffect, useState } from 'react';

/**
 * A brief confirmation for one-tap actions — "Water +1", "✓ Read" — that
 * needs no decision from you, unlike the update banner or rest timer which
 * stay up until you act. Auto-dismisses; at most one shows at a time, which
 * is exactly right for a dock where taps are quick and sequential.
 */
let notify: (message: string) => void = () => {};

export function showToast(message: string): void {
  notify(message);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number;
    notify = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 2200);
    };
    return () => {
      notify = () => {};
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3"
    >
      <div className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-lg">
        {message}
      </div>
    </div>
  );
}
