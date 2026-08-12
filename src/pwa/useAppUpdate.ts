import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps the installed app current.
 *
 * The service worker precaches every build, so the app opens instantly and
 * works with no network. When a new build is deployed, the worker downloads it
 * in the background and this hook flips `updateReady` — the UI then offers a
 * reload rather than yanking the page out from under whatever is half-typed.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

let applyUpdate: (reload?: boolean) => Promise<void> = async () => {};
let manualCheck: () => Promise<void> = async () => {};
const listeners = new Set<(ready: boolean) => void>();
let ready = false;
let registered = false;

function announce(next: boolean) {
  ready = next;
  listeners.forEach((fn) => fn(next));
}

function ensureRegistered() {
  if (registered) return;
  registered = true;

  applyUpdate = registerSW({
    onNeedRefresh() {
      announce(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      manualCheck = async () => {
        await registration.update();
      };
      // Poll on a slow cadence, and again whenever the app is brought back to
      // the foreground — that is when a phone actually notices a new build.
      const timer = setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
      const onVisible = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onVisible);
      // The registration lives for the page's lifetime; this is cleanup for the
      // benefit of hot reloads during development.
      window.addEventListener('beforeunload', () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onVisible);
      });
    },
    onRegisterError(error) {
      console.error('Service worker did not register.', error);
    },
  });
}

export interface AppUpdate {
  /** A newer build is downloaded and waiting. */
  updateReady: boolean;
  /** Swap to the new build and reload. */
  update: () => void;
  /** Ask the server whether a newer build exists, right now. */
  checkNow: () => Promise<void>;
}

export function useAppUpdate(): AppUpdate {
  const [updateReady, setUpdateReady] = useState(ready);

  useEffect(() => {
    ensureRegistered();
    listeners.add(setUpdateReady);
    setUpdateReady(ready);
    return () => {
      listeners.delete(setUpdateReady);
    };
  }, []);

  return {
    updateReady,
    update: () => void applyUpdate(true),
    checkNow: () => manualCheck(),
  };
}
