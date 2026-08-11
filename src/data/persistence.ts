import type { AppState } from '@/types';

/**
 * The one seam between the app and where its bytes live.
 *
 * Everything above this file talks to `Persistence`, never to localStorage
 * directly. Swapping in IndexedDB (Dexie), SQLite (Tauri / better-sqlite3), or
 * a sync server later means writing one more class here and changing the single
 * export at the bottom — no component or hook has to change.
 */
export interface Persistence {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

export const STORAGE_KEY = 'performace.state.v1';

export class LocalStoragePersistence implements Persistence {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<AppState | null> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw) as AppState;
    } catch (err) {
      // A corrupt blob should not brick the app — fall back to a fresh seed and
      // keep the bad copy around so nothing is silently destroyed.
      console.error('Could not read saved data; keeping a backup copy.', err);
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) localStorage.setItem(`${this.key}.corrupt.${Date.now()}`, raw);
      } catch {
        /* storage is full or unavailable; nothing more we can do */
      }
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch (err) {
      console.error('Could not save data (storage may be full).', err);
      throw err;
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}

/** The adapter the app actually uses. Change this line to change the backend. */
export const persistence: Persistence = new LocalStoragePersistence();
