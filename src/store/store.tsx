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
import { emptyState, STATE_VERSION } from '@/data/seed';
import { DEFAULT_ROUTINES, DEFAULT_SETTINGS, defaultQuickActions } from '@/data/defaults';
import { uid } from '@/lib/id';
import type {
  AppState,
  Assignment,
  CollectionKey,
  DayLog,
  DayRoutine,
  ISODate,
  QuickAction,
  RecordOf,
  ScheduleBlock,
  Settings,
  Weekday,
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
  | { type: 'routine'; weekday: Weekday; patch: Partial<DayRoutine> }
  | { type: 'day'; date: ISODate; patch: Partial<DayLog> }
  | { type: 'setBlocks'; date: ISODate; blocks: ScheduleBlock[] }
  | { type: 'setQuickActions'; actions: QuickAction[] };

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

    case 'routine':
      return {
        ...state,
        settings: {
          ...state.settings,
          routines: {
            ...state.settings.routines,
            [action.weekday]: { ...state.settings.routines[action.weekday], ...action.patch },
          },
        },
      };

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

    case 'setQuickActions':
      return { ...state, quickActions: action.actions };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/** The shape Settings had before per-day routines (version 1). */
interface LegacySettings {
  wakeTime?: string;
  bedTime?: string;
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  workoutTime?: string;
  readingTime?: string;
  routines?: unknown;
}

function migrateSettings(raw: Partial<Settings> & LegacySettings): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...raw, routines: DEFAULT_ROUTINES };

  if (raw.routines && typeof raw.routines === 'object') {
    // Already on the new shape.
    merged.routines = { ...DEFAULT_ROUTINES, ...(raw.routines as Record<Weekday, DayRoutine>) };
  } else if (raw.wakeTime) {
    // Version 1: one flat routine applied to every day.
    const flat: DayRoutine = {
      wakeTime: raw.wakeTime,
      bedTime: raw.bedTime ?? DEFAULT_ROUTINES[1].bedTime,
      breakfastTime: raw.breakfastTime ?? DEFAULT_ROUTINES[1].breakfastTime,
      lunchTime: raw.lunchTime ?? DEFAULT_ROUTINES[1].lunchTime,
      dinnerTime: raw.dinnerTime ?? DEFAULT_ROUTINES[1].dinnerTime,
      workoutTime: raw.workoutTime,
      readingTime: raw.readingTime ?? DEFAULT_ROUTINES[1].readingTime,
    };
    merged.routines = { 0: flat, 1: flat, 2: flat, 3: flat, 4: flat, 5: flat, 6: flat };
  }

  return merged;
}

/**
 * Schedule blocks the app used to place on its own before "never guess
 * anything" became a hard rule: the old blanket weekday class block, and
 * homework pulled into gaps with no per-assignment opt-in. Both are safe to
 * drop unconditionally — a block only ever survives a regenerate by being
 * `manual` or `completed` (see `protectedBlocks`), so anything matching these
 * shapes was, by definition, a guess nobody asked for and is disposable.
 */
function stripGuessedBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return blocks.filter((b) => {
    if (b.manual || b.completed) return true;
    // The old auto-fill signature: kind 'school', source type still 'manual'
    // because the pre-fix code never attached a real course. Current code
    // only ever produces school blocks with source type 'course'.
    if (b.kind === 'school' && b.source.type === 'manual') return false;
    // Homework auto-placed before assignments had a per-item opt-in.
    if (b.source.type === 'assignment') return false;
    return true;
  });
}

/**
 * Brings a persisted blob up to the current shape. Version-specific transforms
 * get their own branch as the schema evolves; today that's the settings
 * restructure, backfilling any collection that did not exist yet, giving
 * older assignments their new `schedule` opt-in (off, matching the same
 * "nothing is guessed" default new ones get), and clearing out blocks the app
 * placed on its own before that rule existed.
 */
function migrate(raw: AppState): AppState {
  const base = emptyState();
  const merged: AppState = {
    ...base,
    ...raw,
    version: STATE_VERSION,
    settings: migrateSettings(raw.settings ?? {}),
  };
  // Never let a missing array crash a `.map` deep in a card.
  (Object.keys(base) as (keyof AppState)[]).forEach((k) => {
    if (Array.isArray(base[k]) && !Array.isArray(merged[k])) {
      (merged as unknown as Record<string, unknown>)[k] = [];
    }
  });
  // Older persisted assignments predate the `schedule` field entirely, even
  // though the current type claims it is always present — this is exactly
  // that boundary, so the incoming value is treated as possibly missing it.
  merged.assignments = merged.assignments.map((a) => {
    const loose = a as Partial<Assignment>;
    return { ...a, schedule: loose.schedule ?? false };
  });
  merged.blocks = stripGuessedBlocks(merged.blocks);
  if (!merged.quickActions?.length) {
    merged.quickActions = defaultQuickActions(merged.habits);
  }
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
  updateRoutine: (weekday: Weekday, patch: Partial<DayRoutine>) => void;
  updateDay: (date: ISODate, patch: Partial<DayLog>) => void;
  setBlocks: (date: ISODate, blocks: ScheduleBlock[]) => void;
  setQuickActions: (actions: QuickAction[]) => void;
  replaceAll: (state: AppState) => void;
  /** Erases every tracked record but keeps the default checklist and Orthodox rule. */
  resetToDefaults: () => void;
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
      dispatch({ type: 'hydrate', state: loaded ? migrate(loaded) : emptyState() });
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
    // Every "new record" form seeds its draft with id: '' as a sentinel, so
    // this has to treat an empty string as absent too — `??` alone would
    // leave every new record sharing the same blank id.
    const id = item.id || uid(key.slice(0, 4));
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
      updateRoutine: (weekday, patch) => dispatch({ type: 'routine', weekday, patch }),
      updateDay: (date, patch) => dispatch({ type: 'day', date, patch }),
      setBlocks: (date, blocks) => dispatch({ type: 'setBlocks', date, blocks }),
      setQuickActions: (actions) => dispatch({ type: 'setQuickActions', actions }),
      replaceAll: (next) => dispatch({ type: 'replace', state: migrate(next) }),
      resetToDefaults: () => dispatch({ type: 'replace', state: emptyState() }),
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
