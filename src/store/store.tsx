import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { persistence } from '@/data/persistence';
import { emptyState, seedState, STATE_VERSION } from '@/data/seed';
import { DEFAULT_SETTINGS } from '@/data/defaults';
import { uid } from '@/lib/id';
import type {
  AppState,
  CollectionKey,
  DayLog,
  ISODate,
  RecordOf,
  ScheduleBlock,
  Settings,
} from '@/types';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'replace'; state: AppState }
  | { type: 'add'; key: CollectionKey; item: RecordOf<CollectionKey> }
  | { type: 'update'; key: CollectionKey; id: string; patch: Record<string, unknown> }
  | { type: 'remove'; key: CollectionKey; id: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'day'; date: ISODate; patch: Partial<DayLog> }
  | { type: 'setBlocks'; date: ISODate; blocks: ScheduleBlock[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'replace':
      return action.state;

    case 'add':
      return { ...state, [action.key]: [...state[action.key], action.item] } as AppState;

    case 'update':
      return {
        ...state,
        [action.key]: (state[action.key] as { id: string }[]).map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      } as AppState;

    case 'remove':
      return {
        ...state,
        [action.key]: (state[action.key] as { id: string }[]).filter((r) => r.id !== action.id),
      } as AppState;

    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'day': {
      const existing = state.days.find((d) => d.date === action.date);
      const next: DayLog = existing
        ? { ...existing, ...action.patch }
        : { date: action.date, waterCups: 0, ...action.patch };
      return {
        ...state,
        days: existing
          ? state.days.map((d) => (d.date === action.date ? next : d))
          : [...state.days, next],
      };
    }

    case 'setBlocks':
      return {
        ...state,
        blocks: [...state.blocks.filter((b) => b.date !== action.date), ...action.blocks],
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Brings a persisted blob up to the current shape. Today it only backfills
 * missing keys, which is exactly what an added feature needs; version-specific
 * transforms get their own branch as the schema evolves.
 */
function migrate(raw: AppState): AppState {
  const base = emptyState();
  const merged: AppState = {
    ...base,
    ...raw,
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  };
  // Never let a missing array crash a `.map` deep in a card.
  (Object.keys(base) as (keyof AppState)[]).forEach((k) => {
    if (Array.isArray(base[k]) && !Array.isArray(merged[k])) {
      (merged as unknown as Record<string, unknown>)[k] = [];
    }
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StoreValue {
  state: AppState;
  ready: boolean;
  /** Create a record. `id` and any omitted defaults are filled in for you. */
  add: <K extends CollectionKey>(key: K, item: Omit<RecordOf<K>, 'id'> & { id?: string }) => string;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<RecordOf<K>>) => void;
  remove: (key: CollectionKey, id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateDay: (date: ISODate, patch: Partial<DayLog>) => void;
  setBlocks: (date: ISODate, blocks: ScheduleBlock[]) => void;
  replaceAll: (state: AppState) => void;
  resetToSample: () => void;
  resetToEmpty: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null as unknown as AppState, emptyState);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  // Load once on mount. Nothing is written back until this finishes, so a slow
  // read can never be overwritten by the empty initial state.
  useEffect(() => {
    let cancelled = false;
    persistence.load().then((loaded) => {
      if (cancelled) return;
      dispatch({ type: 'hydrate', state: loaded ? migrate(loaded) : seedState() });
      hydrated.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, debounced so a burst of checkbox taps writes once.
  useEffect(() => {
    if (!hydrated.current) return;
    const handle = setTimeout(() => {
      void persistence.save(state);
    }, 200);
    return () => clearTimeout(handle);
  }, [state]);

  const add = useCallback<StoreValue['add']>((key, item) => {
    const id = item.id ?? uid(key.slice(0, 4));
    dispatch({ type: 'add', key, item: { ...item, id } as RecordOf<CollectionKey> });
    return id;
  }, []);

  const update = useCallback<StoreValue['update']>((key, id, patch) => {
    dispatch({ type: 'update', key, id, patch: patch as Record<string, unknown> });
  }, []);

  const remove = useCallback<StoreValue['remove']>((key, id) => {
    dispatch({ type: 'remove', key, id });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      add,
      update,
      remove,
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      updateDay: (date, patch) => dispatch({ type: 'day', date, patch }),
      setBlocks: (date, blocks) => dispatch({ type: 'setBlocks', date, blocks }),
      replaceAll: (next) => dispatch({ type: 'replace', state: migrate(next) }),
      resetToSample: () => dispatch({ type: 'replace', state: seedState() }),
      resetToEmpty: () => dispatch({ type: 'replace', state: emptyState() }),
    }),
    [state, ready, add, update, remove],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Convenience for the common read-only case. */
export function useAppState(): AppState {
  return useStore().state;
}

export function useSettings(): Settings {
  return useStore().state.settings;
}
