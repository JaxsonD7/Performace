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
import { createSyncGist, fetchSyncGist, pushSyncGist, SyncError } from '@/integrations/sync/github';
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
  | { type: 'setQuickActions'; actions: QuickAction[] }
  | { type: 'removeHabit'; id: string }
  | { type: 'dismissMail'; id: string }
  | { type: 'logMealPrep'; batchId: string; meal: RecordOf<'meals'> };

/**
 * `hydrate` and `replace` carry their own `updatedAt` (loaded from disk or
 * pulled from the sync gist) — stamping over it would make every load look
 * like a fresh edit and defeat last-write-wins. Every actual local mutation
 * gets `Date.now()` so cloud sync knows this device has something newer to
 * push.
 */
function reducer(state: AppState, action: Action): AppState {
  const next = applyAction(state, action);
  if (action.type === 'hydrate' || action.type === 'replace') return next;
  return next === state ? state : { ...next, updatedAt: Date.now() };
}

function applyAction(state: AppState, action: Action): AppState {
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
        : { date: action.date, waterOz: 0, ...action.patch };
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

    case 'removeHabit':
      return {
        ...state,
        habits: state.habits.filter((h) => h.id !== action.id),
        // A deleted habit can't leave dangling references — a log for a habit
        // that no longer exists, a dock button that toggles nothing, or a
        // goal silently tracking a habit that vanished.
        habitLogs: state.habitLogs.filter((l) => l.habitId !== action.id),
        quickActions: state.quickActions.map((qa) =>
          qa.type === 'habit-toggle' && qa.habitId === action.id
            ? { ...qa, type: 'none', habitId: undefined, label: 'Empty', icon: '·' }
            : qa,
        ),
        goals: state.goals.map((g) =>
          g.linkedHabitId === action.id ? { ...g, linkedHabitId: undefined } : g,
        ),
      };

    case 'dismissMail':
      return state.dismissedMailIds.includes(action.id)
        ? state
        : { ...state, dismissedMailIds: [...state.dismissedMailIds, action.id] };

    case 'logMealPrep':
      return {
        ...state,
        meals: [...state.meals, action.meal],
        mealPrepBatches: state.mealPrepBatches.map((b) =>
          b.id === action.batchId ? { ...b, servingsLeft: Math.max(0, b.servingsLeft - 1) } : b,
        ),
      };

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

/** Old records tracked water in cups; one cup converts to 8 fluid ounces. */
const CUP_TO_OZ = 8;

/**
 * Brings a persisted blob up to the current shape. Version-specific transforms
 * get their own branch as the schema evolves; today that's the settings
 * restructure, backfilling any collection that did not exist yet, giving
 * older assignments their new `schedule` opt-in (off, matching the same
 * "nothing is guessed" default new ones get), clearing out blocks the app
 * placed on its own before that rule existed, and converting water tracking
 * from cups to ounces.
 */
function migrate(raw: AppState): AppState {
  const base = emptyState();
  const rawSettings = raw.settings as (Partial<Settings> & { waterGoalCups?: number }) | undefined;
  const merged: AppState = {
    ...base,
    ...raw,
    version: STATE_VERSION,
    // Data with no recorded edit time is real, already-persisted data from
    // before this field existed — treat it as "just edited" rather than
    // ancient, so it isn't mistaken for the older copy the first time this
    // device compares itself against a sync gist.
    updatedAt: raw.updatedAt || Date.now(),
    settings: migrateSettings(rawSettings ?? {}),
  };
  if (rawSettings?.waterGoalCups && !rawSettings.waterGoalOz) {
    merged.settings.waterGoalOz = rawSettings.waterGoalCups * CUP_TO_OZ;
  }
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
  merged.days = merged.days.map((d) => {
    const loose = d as DayLog & { waterCups?: number };
    if (loose.waterCups != null && loose.waterOz == null) {
      return { ...d, waterOz: loose.waterCups * CUP_TO_OZ };
    }
    return d;
  });
  merged.health = merged.health.map((h) => {
    const loose = h as typeof h & { waterCups?: number };
    if (loose.waterCups != null && loose.waterOz == null) {
      return { ...h, waterOz: loose.waterCups * CUP_TO_OZ };
    }
    return h;
  });
  merged.blocks = stripGuessedBlocks(merged.blocks);
  if (!merged.quickActions?.length) {
    merged.quickActions = defaultQuickActions(merged.habits);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Cloud sync
// ---------------------------------------------------------------------------

/**
 * The gist token and ID are this device's own credentials, not data to
 * mirror — pushing them would leak one device's token into the shared file,
 * and pulling them would make a second device silently start using the
 * first device's token. Every payload that leaves this device has them
 * stripped; every payload adopted from the gist gets this device's own
 * values reattached instead of whatever (nothing) came back.
 */
function stripSyncCreds(s: AppState): AppState {
  const { githubToken: _token, syncGistId: _gistId, ...rest } = s.settings;
  return { ...s, settings: rest as Settings };
}

function attachSyncCreds(s: AppState, token: string, gistId: string): AppState {
  return { ...s, settings: { ...s.settings, githubToken: token, syncGistId: gistId } };
}

async function pullRemote(token: string, gistId: string): Promise<AppState | null> {
  const json = await fetchSyncGist(token, gistId);
  if (!json) return null;
  return migrate(JSON.parse(json) as AppState);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface SyncStatus {
  connected: boolean;
  state: 'idle' | 'syncing' | 'error';
  error?: string;
  lastSyncedAt?: number;
}

interface StoreValue {
  state: AppState;
  ready: boolean;
  sync: SyncStatus;
  /**
   * Turns on cloud sync. Pass an existing gist ID to join a device that
   * already has one going (this is how a second device connects to the
   * first); omit it to mint a brand new gist for this to be the first
   * device on.
   */
  connectSync: (token: string, existingGistId?: string) => Promise<void>;
  /** Stops syncing on this device. The gist itself is untouched. */
  disconnectSync: () => void;
  /** Pushes or pulls right now instead of waiting for the debounce. */
  syncNow: () => Promise<void>;
  /** Create a record. `id` and any omitted defaults are filled in for you. */
  add: <K extends CollectionKey>(key: K, item: Omit<RecordOf<K>, 'id'> & { id?: string }) => string;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<RecordOf<K>>) => void;
  remove: (key: CollectionKey, id: string) => void;
  /** Removing a habit also clears its logs and unlinks it from quick actions and goals. */
  removeHabit: (id: string) => void;
  /** Clears one mail-digest item; it won't reappear even once the digest file regenerates. */
  dismissMail: (id: string) => void;
  /** Logs a meal from a prepped batch and decrements its remaining-servings count, atomically. */
  logMealPrep: (batchId: string, meal: Omit<RecordOf<'meals'>, 'id'> & { id?: string }) => void;
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
  const stateRef = useRef(state);
  stateRef.current = state;

  const [sync, setSync] = useState<SyncStatus>({ connected: false, state: 'idle' });
  // The `updatedAt` this device last confirmed matches the gist — pushing or
  // pulling both move it forward. As long as it equals the live state's own
  // `updatedAt`, there is nothing new to send.
  const settledUpdatedAt = useRef<number | null>(null);

  // Load once on mount. Nothing is written back until this finishes, so a slow
  // read can never be overwritten by the empty initial state.
  useEffect(() => {
    let cancelled = false;
    persistence.load().then((loaded) => {
      if (cancelled) return;
      const initial = loaded ? migrate(loaded) : emptyState();
      dispatch({ type: 'hydrate', state: initial });
      hydrated.current = true;
      setReady(true);
      if (initial.settings.githubToken && initial.settings.syncGistId) {
        setSync({ connected: true, state: 'idle' });
        void reconcile(initial.settings.githubToken, initial.settings.syncGistId);
      }
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

  // Mirror to the sync gist on every change, once things settle — a much
  // longer debounce than the local save, since this one costs a real network
  // request against GitHub's API rather than a write to this browser's disk.
  useEffect(() => {
    if (!hydrated.current) return;
    const { githubToken, syncGistId } = state.settings;
    if (!githubToken || !syncGistId) return;
    if (settledUpdatedAt.current === state.updatedAt) return;
    const handle = setTimeout(() => {
      void pushLocal(githubToken, syncGistId, state);
    }, 2500);
    return () => clearTimeout(handle);
  }, [state]);

  /** Pushes this device's current copy up, marking it settled on success. */
  const pushLocal = useCallback(async (token: string, gistId: string, toPush: AppState) => {
    setSync((s) => ({ ...s, state: 'syncing' }));
    try {
      await pushSyncGist(token, gistId, JSON.stringify(stripSyncCreds(toPush)));
      settledUpdatedAt.current = toPush.updatedAt;
      setSync({ connected: true, state: 'idle', lastSyncedAt: Date.now() });
    } catch (err) {
      setSync({
        connected: true,
        state: 'error',
        error: err instanceof SyncError ? err.message : 'Sync failed.',
      });
    }
  }, []);

  /**
   * Pulls the remote copy and keeps whichever side has the later edit —
   * last-write-wins, which is enough for one person moving between their own
   * two devices rather than two people editing at once. The token and gist ID
   * are this device's own credentials, never part of what gets compared or
   * adopted — only content ever flows through the gist.
   */
  const reconcile = useCallback(
    async (token: string, gistId: string) => {
      setSync((s) => ({ ...s, state: 'syncing' }));
      try {
        const remote = await pullRemote(token, gistId);
        const local = stateRef.current;
        if (remote && remote.updatedAt > local.updatedAt) {
          const merged = attachSyncCreds(remote, token, gistId);
          settledUpdatedAt.current = merged.updatedAt;
          dispatch({ type: 'replace', state: merged });
          setSync({ connected: true, state: 'idle', lastSyncedAt: Date.now() });
        } else {
          await pushLocal(token, gistId, local);
        }
      } catch (err) {
        setSync({
          connected: true,
          state: 'error',
          error: err instanceof SyncError ? err.message : 'Sync failed.',
        });
      }
    },
    [pushLocal],
  );

  const connectSync = useCallback<StoreValue['connectSync']>(
    async (token, existingGistId) => {
      setSync({ connected: false, state: 'syncing' });
      try {
        const local = stateRef.current;
        let gistId = existingGistId;
        let final: AppState;
        if (gistId) {
          // Joining a device that already has sync going — pull first so
          // connecting never silently overwrites what is already up there.
          const remote = await pullRemote(token, gistId);
          if (remote && remote.updatedAt > local.updatedAt) {
            final = attachSyncCreds(remote, token, gistId);
            settledUpdatedAt.current = final.updatedAt;
          } else {
            final = attachSyncCreds(local, token, gistId);
            await pushSyncGist(token, gistId, JSON.stringify(stripSyncCreds(final)));
            settledUpdatedAt.current = final.updatedAt;
          }
        } else {
          // First device — mint a new gist seeded with what is already here.
          gistId = await createSyncGist(token, JSON.stringify(stripSyncCreds(local)));
          final = attachSyncCreds(local, token, gistId);
          settledUpdatedAt.current = final.updatedAt;
        }
        dispatch({ type: 'replace', state: final });
        setSync({ connected: true, state: 'idle', lastSyncedAt: Date.now() });
      } catch (err) {
        setSync({
          connected: false,
          state: 'error',
          error: err instanceof SyncError ? err.message : 'Could not connect sync.',
        });
      }
    },
    [],
  );

  const disconnectSync = useCallback<StoreValue['disconnectSync']>(() => {
    dispatch({ type: 'settings', patch: { githubToken: undefined, syncGistId: undefined } });
    settledUpdatedAt.current = null;
    setSync({ connected: false, state: 'idle' });
  }, []);

  const syncNow = useCallback<StoreValue['syncNow']>(async () => {
    const { githubToken, syncGistId } = stateRef.current.settings;
    if (!githubToken || !syncGistId) return;
    await reconcile(githubToken, syncGistId);
  }, [reconcile]);

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

  const logMealPrep = useCallback<StoreValue['logMealPrep']>((batchId, meal) => {
    const id = meal.id || uid('meal');
    dispatch({ type: 'logMealPrep', batchId, meal: { ...meal, id } as RecordOf<'meals'> });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      sync,
      connectSync,
      disconnectSync,
      syncNow,
      add,
      update,
      remove,
      removeHabit: (id) => dispatch({ type: 'removeHabit', id }),
      dismissMail: (id) => dispatch({ type: 'dismissMail', id }),
      logMealPrep,
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      updateRoutine: (weekday, patch) => dispatch({ type: 'routine', weekday, patch }),
      updateDay: (date, patch) => dispatch({ type: 'day', date, patch }),
      setBlocks: (date, blocks) => dispatch({ type: 'setBlocks', date, blocks }),
      setQuickActions: (actions) => dispatch({ type: 'setQuickActions', actions }),
      replaceAll: (next) => dispatch({ type: 'replace', state: migrate(next) }),
      resetToDefaults: () => dispatch({ type: 'replace', state: emptyState() }),
    }),
    [state, ready, sync, connectSync, disconnectSync, syncNow, add, update, remove, logMealPrep],
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
