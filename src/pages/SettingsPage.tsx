import { useRef, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import {
  Badge,
  Card,
  CardHeader,
  Field,
  Segmented,
  Select,
  TextInput,
} from '@/components/ui/primitives';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { numOr } from '@/components/forms/useFormDraft';
import {
  exportCollectionCSV,
  exportJSON,
  importJSONFile,
} from '@/integrations/export/exporters';
import { AppCard } from '@/pwa/AppCard';
import { requestPermission } from '@/integrations/notifications';
import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/lib/routine';
import { useStore } from '@/store/store';
import type { CollectionKey, DataSource, DayRoutine, OrthodoxCalendar, Settings, ThemePreference, Weekday, WeightUnit } from '@/types';

const CSV_COLLECTIONS: [CollectionKey, string][] = [
  ['tasks', 'Tasks'],
  ['habitLogs', 'Habit log'],
  ['meals', 'Meals'],
  ['sleep', 'Sleep'],
  ['workouts', 'Workouts'],
  ['reading', 'Reading'],
  ['assignments', 'Assignments'],
  ['meetings', 'Meetings'],
  ['goals', 'Goals'],
  ['health', 'Health metrics'],
];

export function SettingsPage() {
  const { state, updateSettings, replaceAll, resetToDefaults } = useStore();
  const s = state.settings;
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setNumber = (key: keyof Settings, fallback: number) => (value: string) =>
    updateSettings({ [key]: numOr(value, fallback) } as Partial<Settings>);

  const onImport = async (file: File) => {
    try {
      const next = await importJSONFile(file);
      replaceAll(next);
      setMessage('Backup restored.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your rhythm, your goals, and where the data lives." />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="You" icon="👤" />
            <div className="card-pad space-y-4">
              <Field label="Name" hint="Used for the greeting on the Today page">
                <TextInput
                  value={s.name}
                  onChange={(e) => updateSettings({ name: e.target.value })}
                  placeholder="Your name"
                />
              </Field>
              <div>
                <span className="label">Theme</span>
                <Segmented<ThemePreference>
                  value={s.theme}
                  onChange={(theme) => updateSettings({ theme })}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
              <div>
                <span className="label">Week starts on</span>
                <Segmented<'0' | '1'>
                  value={String(s.weekStartsOn) as '0' | '1'}
                  onChange={(v) => updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
                  options={[
                    { value: '0', label: 'Sunday' },
                    { value: '1', label: 'Monday' },
                  ]}
                />
              </div>
              <Field label="Health device" hint="Which source new entries default to">
                <Select
                  value={s.healthDevice}
                  onChange={(e) => updateSettings({ healthDevice: e.target.value as DataSource })}
                >
                  <option value="apple-watch">Apple Watch</option>
                  <option value="apple-health">Apple Health</option>
                  <option value="garmin">Garmin</option>
                  <option value="fitbit">Fitbit</option>
                  <option value="manual">Manual only</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="label">Weight unit</span>
                  <Segmented<WeightUnit>
                    value={s.weightUnit}
                    onChange={(weightUnit) => updateSettings({ weightUnit })}
                    options={[
                      { value: 'lb', label: 'lb' },
                      { value: 'kg', label: 'kg' },
                    ]}
                  />
                </div>
                <Field label="Rest timer (sec)">
                  <TextInput
                    type="number"
                    min={0}
                    step={15}
                    value={s.restTimerSec}
                    onChange={(e) => setNumber('restTimerSec', 90)(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <AppCard />
          <CloudSyncCard />
          <HomeAssistantCard />

          <NotificationsCard />
          <OrthodoxCalendarCard />
          <ClaudeVisionCard />

          <div className="min-w-0 lg:col-span-2">
            <RoutinesCard />
          </div>

          <Card>
            <CardHeader title="Targets" icon="🎯" />
            <div className="card-pad grid grid-cols-2 gap-3">
              <Field label="Sleep goal (min)">
                <TextInput
                  type="number"
                  step={15}
                  value={s.sleepGoalMin}
                  onChange={(e) => setNumber('sleepGoalMin', 480)(e.target.value)}
                />
              </Field>
              <Field label="Reading goal (min/day)">
                <TextInput
                  type="number"
                  value={s.readingGoalMin}
                  onChange={(e) => setNumber('readingGoalMin', 30)(e.target.value)}
                />
              </Field>
              <Field label="Water (oz/day)">
                <TextInput
                  type="number"
                  value={s.waterGoalOz}
                  onChange={(e) => setNumber('waterGoalOz', 64)(e.target.value)}
                />
              </Field>
              <Field label="Steps/day">
                <TextInput
                  type="number"
                  step={500}
                  value={s.stepGoal}
                  onChange={(e) => setNumber('stepGoal', 10000)(e.target.value)}
                />
              </Field>
              <Field label="Calories/day">
                <TextInput
                  type="number"
                  step={50}
                  value={s.calorieGoal}
                  onChange={(e) => setNumber('calorieGoal', 2400)(e.target.value)}
                />
              </Field>
              <Field label="Protein (g/day)">
                <TextInput
                  type="number"
                  step={5}
                  value={s.proteinGoal}
                  onChange={(e) => setNumber('proteinGoal', 150)(e.target.value)}
                />
              </Field>
              <Field label="Workouts/week">
                <TextInput
                  type="number"
                  min={0}
                  max={7}
                  value={s.workoutsPerWeekGoal}
                  onChange={(e) => setNumber('workoutsPerWeekGoal', 5)(e.target.value)}
                />
              </Field>
              <Field label="Focus block (min)">
                <TextInput
                  type="number"
                  min={15}
                  step={5}
                  value={s.focusBlockMin}
                  onChange={(e) => setNumber('focusBlockMin', 50)(e.target.value)}
                />
              </Field>
              <Field label="Break (min)">
                <TextInput
                  type="number"
                  min={0}
                  step={5}
                  value={s.breakMin}
                  onChange={(e) => setNumber('breakMin', 10)(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Your data"
              icon="💾"
              subtitle="Stored in this browser only — no account, no server."
            />
            <div className="card-pad space-y-4">
              <div className="rounded-lg bg-raised px-3 py-2.5 text-xs text-ink-secondary">
                <p className="mb-1 font-medium text-ink">What is saved</p>
                <p className="tabular-nums">
                  {state.tasks.length} tasks · {state.habits.length} habits ·{' '}
                  {state.habitLogs.length} habit entries · {state.meals.length} meals ·{' '}
                  {state.sleep.length} nights · {state.workouts.length} workouts ·{' '}
                  {state.reading.length} reading sessions · {state.assignments.length} assignments ·{' '}
                  {state.meetings.length} events · {state.courseMeetings.length} class times ·{' '}
                  {state.goals.length} goals · {state.health.length} health days
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost" onClick={() => exportJSON(state)}>
                  Export backup (JSON)
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => fileInput.current?.click()}
                >
                  Restore from backup
                </button>
                <button type="button" className="btn-ghost" onClick={() => window.print()}>
                  Print / save as PDF
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImport(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div>
                <span className="label">Export a table as CSV</span>
                <div className="flex flex-wrap gap-1.5">
                  {CSV_COLLECTIONS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className="chip hover:bg-raised"
                      onClick={() => exportCollectionCSV(state, key)}
                      disabled={!state[key].length}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {message ? (
                <p className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink-secondary">
                  {message}
                </p>
              ) : null}

              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  className="btn text-critical hover:bg-critical/10"
                  onClick={() => setConfirmErase(true)}
                >
                  Erase everything
                </button>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Already wired up"
            icon="✓"
            subtitle="Apple Watch, calendar, reminders, exports — all live, all in this settings page."
          />
          <div className="card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Seam
              title="Apple Watch pairing"
              path="Health & Gym → Watch"
              body="Shortcut push for daily numbers, or a one-time Health export for history."
            />
            <Seam
              title="Calendar import / export"
              path="School & Tasks → Meetings"
              body="Bring in a .ics from any calendar app, or export meetings, classes, and due dates to one."
            />
            <Seam
              title="Reminders"
              path="Settings → Reminders"
              body="Browser notifications a few minutes before each block — while this tab is open."
            />
            <Seam
              title="Charts & reports"
              path="src/components/ui/charts.tsx"
              body="Bars, tiles, and week dots are shared primitives — new charts reuse them."
            />
            <Seam
              title="CSV / PDF export"
              path="Settings → Your data"
              body="CSV per table, a full JSON backup, or print-to-PDF."
            />
          </div>
          <div className="card-pad pt-0">
            <p className="text-xs text-ink-muted">
              Still just a seam:{' '}
              <code className="rounded bg-raised px-1 text-brand">src/integrations/ai</code> — an AI
              day-planner that would replace the rules-based scheduler. Left alone on purpose: this
              app's whole point is that nothing about your day gets guessed, and an AI planner is
              exactly a kind of guess. If you want that anyway, say the word and how much control it
              should have.
            </p>
          </div>
        </Card>
      </PageBody>

      <Modal
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title="Erase everything?"
        footer={
          <ModalActions
            onCancel={() => setConfirmErase(false)}
            destructive
            confirmLabel="Erase"
            onConfirm={() => {
              resetToDefaults();
              setConfirmErase(false);
              setMessage('All data erased. The default checklist and Orthodox rule are still here.');
            }}
          />
        }
      >
        <p className="text-sm text-ink-secondary">
          This deletes every task, habit log, meal, workout, class, and reading session in this
          browser. The default daily checklist and Orthodox rule are kept so the app still works.
          This cannot be undone — export a backup first if you want to keep what you have.
        </p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------

function RoutinesCard() {
  const { state, updateRoutine } = useStore();
  const [day, setDay] = useState<Weekday>(() => new Date().getDay() as Weekday);
  const routine = state.settings.routines[day];

  const set = (patch: Partial<DayRoutine>) => updateRoutine(day, patch);

  const copyToAll = () => {
    WEEKDAYS.forEach((d) => {
      if (d !== day) updateRoutine(d, routine);
    });
  };

  const copyToWeekdays = () => {
    [1, 2, 3, 4, 5].forEach((d) => {
      if (d !== day) updateRoutine(d as Weekday, routine);
    });
  };

  return (
    <Card>
      <CardHeader
        title="Daily rhythm"
        icon="🕰️"
        subtitle="Its own wake, meal, and workout times for every day — school days and weekends rarely match."
      />
      <div className="card-pad space-y-4">
        <div className="scroll-x">
          <div className="inline-flex rounded-lg border border-line bg-raised p-0.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors ${
                  day === d ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink-secondary'
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Wake up">
            <TextInput type="time" value={routine.wakeTime} onChange={(e) => set({ wakeTime: e.target.value })} />
          </Field>
          <Field label="Bed time">
            <TextInput type="time" value={routine.bedTime} onChange={(e) => set({ bedTime: e.target.value })} />
          </Field>
          <Field label="Breakfast">
            <TextInput
              type="time"
              value={routine.breakfastTime}
              onChange={(e) => set({ breakfastTime: e.target.value })}
            />
          </Field>
          <Field label="Lunch">
            <TextInput type="time" value={routine.lunchTime} onChange={(e) => set({ lunchTime: e.target.value })} />
          </Field>
          <Field label="Dinner">
            <TextInput type="time" value={routine.dinnerTime} onChange={(e) => set({ dinnerTime: e.target.value })} />
          </Field>
          <Field label="Reading">
            <TextInput
              type="time"
              value={routine.readingTime}
              onChange={(e) => set({ readingTime: e.target.value })}
            />
          </Field>
          <Field label="Workout" hint="Leave blank on rest days — no gym block gets placed">
            <TextInput
              type="time"
              value={routine.workoutTime ?? ''}
              onChange={(e) => set({ workoutTime: e.target.value || undefined })}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-xs">
          <button type="button" className="btn-quiet !py-1" onClick={copyToWeekdays}>
            Copy {WEEKDAY_NAMES[day]} to Mon–Fri
          </button>
          <button type="button" className="btn-quiet !py-1" onClick={copyToAll}>
            Copy {WEEKDAY_NAMES[day]} to every day
          </button>
        </div>
      </div>
    </Card>
  );
}

function OrthodoxCalendarCard() {
  const { state, updateSettings } = useStore();
  return (
    <Card>
      <CardHeader title="Church calendar" icon="✝️" />
      <div className="card-pad space-y-3">
        <div>
          <span className="label">Calendar tradition</span>
          <Segmented<OrthodoxCalendar>
            value={state.settings.orthodoxCalendar}
            onChange={(orthodoxCalendar) => updateSettings({ orthodoxCalendar })}
            options={[
              { value: 'new', label: 'New (Revised Julian)' },
              { value: 'old', label: 'Old (all-Julian)' },
            ]}
          />
        </div>
        <p className="text-xs text-ink-muted">
          Sets which dates fasting days and feasts fall on. Pascha and everything measured from it
          (Great Lent, Holy Week, Pentecost…) is the same either way — only the fixed feasts and
          the Nativity/Dormition/Apostles' fasts shift by 13 days.
        </p>
      </div>
    </Card>
  );
}

function ClaudeVisionCard() {
  const { state, updateSettings } = useStore();
  const [show, setShow] = useState(false);
  const key = state.settings.anthropicApiKey ?? '';

  return (
    <Card>
      <CardHeader
        title="Meal photo analysis"
        icon="📸"
        action={key ? <Badge tone="good">✓ Connected</Badge> : null}
      />
      <div className="card-pad space-y-3">
        <Field
          label="Anthropic API key"
          hint="Stored only in this browser and sent only to Anthropic, directly from your device, when you tap Analyze on a meal photo. This app has no server of its own to see it."
        >
          <div className="flex gap-2">
            <TextInput
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => updateSettings({ anthropicApiKey: e.target.value || undefined })}
              placeholder="sk-ant-…"
              autoComplete="off"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={() => setShow((v) => !v)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        <p className="text-xs text-ink-muted">
          Get a key at{' '}
          <span className="text-brand">console.anthropic.com</span> → API Keys. Photo analysis costs
          a few cents per photo on your own account; without a key, meals still work — you just log
          calories and macros by hand.
        </p>
      </div>
    </Card>
  );
}

function CloudSyncCard() {
  const { state, sync, connectSync, disconnectSync, syncNow } = useStore();
  const gistId = state.settings.syncGistId;
  const [token, setToken] = useState('');
  const [joinId, setJoinId] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [showId, setShowId] = useState(false);

  const connected = !!gistId;

  const statusLabel = () => {
    if (sync.state === 'syncing') return 'Syncing…';
    if (sync.state === 'error') return sync.error ?? 'Sync error';
    if (sync.lastSyncedAt) return `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}`;
    return 'Connected';
  };

  return (
    <Card>
      <CardHeader
        title="Sync between devices"
        icon="🔗"
        action={
          connected ? (
            <Badge tone={sync.state === 'error' ? 'critical' : 'good'}>
              {sync.state === 'error' ? '⚠ Error' : '✓ Connected'}
            </Badge>
          ) : null
        }
      />
      <div className="card-pad space-y-3">
        {connected ? (
          <>
            <p className="text-xs text-ink-muted">{statusLabel()}</p>
            <Field label="Gist ID" hint="Paste this into your other device's Settings to connect it too">
              <div className="flex gap-2">
                <TextInput readOnly value={showId ? (gistId ?? '') : '••••••••••••••••'} />
                <button type="button" className="btn-ghost shrink-0" onClick={() => setShowId((v) => !v)}>
                  {showId ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => void syncNow()}>
                Sync now
              </button>
              <button type="button" className="btn-ghost" onClick={disconnectSync}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <Field
              label="GitHub token"
              hint="A classic personal access token with only the gist scope — fine-grained tokens don't support gists. Create one at github.com/settings/tokens."
            >
              <TextInput
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_…"
                autoComplete="off"
              />
            </Field>
            <div>
              <span className="label">This device is</span>
              <Segmented<'create' | 'join'>
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'create', label: 'The first one' },
                  { value: 'join', label: 'Joining another' },
                ]}
              />
            </div>
            {mode === 'join' ? (
              <Field label="Gist ID" hint="From the other device's Settings → Sync between devices">
                <TextInput
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Paste the Gist ID here"
                  autoComplete="off"
                />
              </Field>
            ) : null}
            {sync.state === 'error' ? <p className="text-xs text-critical">{sync.error}</p> : null}
            <button
              type="button"
              className="btn-primary"
              disabled={!token.trim() || (mode === 'join' && !joinId.trim()) || sync.state === 'syncing'}
              onClick={() => void connectSync(token.trim(), mode === 'join' ? joinId.trim() : undefined)}
            >
              {sync.state === 'syncing' ? 'Connecting…' : 'Connect'}
            </button>
            <p className="text-xs text-ink-muted">
              Stored only in this browser and sent only to GitHub's API, straight from your device —
              this app has no server of its own to see it. Your data mirrors into one private gist on
              your own account; add the same token (or your own, on the same account) and this gist's
              ID to a second device to keep them in sync.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * One-way, read-only-from-HA's-side export to a dedicated private repo
 * (`JaxsonD7/performace-ha`) — deliberately not the sync gist and not this
 * app's own public repo, since schedule/sleep/gym timing is more sensitive
 * than what already sits on the public mail-digest surface. Nothing is ever
 * read back from that repo into the app.
 */
function HomeAssistantCard() {
  const { state, haSync, haStatus, updateSettings, pushHomeAssistantNow } = useStore();
  const pushConfigured = !!state.settings.haPushToken;
  const readConfigured = !!state.settings.haReadToken;
  const [pushToken, setPushToken] = useState('');
  const [readToken, setReadToken] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const statusLabel = () => {
    if (haSync.state === 'syncing') return 'Pushing…';
    if (haSync.state === 'error') return haSync.error ?? 'Push error';
    if (haSync.lastPushedAt) return `Last pushed ${new Date(haSync.lastPushedAt).toLocaleTimeString()}`;
    return 'Connected — first push on the next edit';
  };

  return (
    <Card>
      <CardHeader
        title="Home Assistant"
        icon="🏠"
        action={
          pushConfigured ? (
            <Badge tone={haSync.state === 'error' ? 'critical' : 'good'}>
              {haSync.state === 'error' ? '⚠ Error' : '✓ Connected'}
            </Badge>
          ) : null
        }
      />
      <div className="card-pad space-y-4">
        <div className="space-y-3">
          <p className="label mb-0">Pushing your schedule to Home Assistant</p>
          {pushConfigured ? (
            <>
              <p className="text-xs text-ink-muted">{statusLabel()}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => void pushHomeAssistantNow()}>
                  Push now
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => updateSettings({ haPushToken: undefined })}
                >
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <Field
                label="Push token"
                hint="A fine-grained PAT scoped only to the performace-ha repo, Contents: Read and write. Different from the sync token above — this one can't touch this app's own repo or your gists."
              >
                <TextInput
                  type="password"
                  value={pushToken}
                  onChange={(e) => setPushToken(e.target.value)}
                  placeholder="github_pat_…"
                  autoComplete="off"
                />
              </Field>
              {haSync.state === 'error' ? <p className="text-xs text-critical">{haSync.error}</p> : null}
              <button
                type="button"
                className="btn-primary"
                disabled={!pushToken.trim()}
                onClick={() => {
                  updateSettings({ haPushToken: pushToken.trim() });
                  setPushToken('');
                }}
              >
                Connect
              </button>
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-line pt-3">
          <p className="label mb-0">Reading presence/temperature from Home Assistant</p>
          {readConfigured ? (
            <>
              <p className="text-xs text-ink-muted">
                {haStatus ? `Last written ${new Date(haStatus.generated_at).toLocaleTimeString()}` : 'Waiting on Home Assistant to write ha-status.json'}
              </p>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => updateSettings({ haReadToken: undefined })}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <Field
                label="Read token"
                hint="A separate fine-grained PAT, Contents: Read-only, scoped to performace-ha — reads ha-status.json, which Home Assistant writes itself. This app never writes to it."
              >
                <TextInput
                  type="password"
                  value={readToken}
                  onChange={(e) => setReadToken(e.target.value)}
                  placeholder="github_pat_…"
                  autoComplete="off"
                />
              </Field>
              <button
                type="button"
                className="btn-primary"
                disabled={!readToken.trim()}
                onClick={() => {
                  updateSettings({ haReadToken: readToken.trim() });
                  setReadToken('');
                }}
              >
                Connect
              </button>
            </>
          )}
        </div>

        <button type="button" className="text-xs text-brand" onClick={() => setShowInfo((v) => !v)}>
          {showInfo ? 'Hide' : 'Show'} the exact endpoints
        </button>
        {showInfo ? (
          <div className="space-y-1.5 rounded-lg border border-line p-3 text-xs text-ink-secondary">
            <p className="font-medium text-ink">Home Assistant reads (schedule/goals context):</p>
            <p className="hud-mono break-all">
              GET https://api.github.com/repos/JaxsonD7/performace-ha/contents/homeassistant.json
            </p>
            <p>
              Headers: <span className="hud-mono">Authorization: Bearer &lt;its own read-only PAT&gt;</span>,{' '}
              <span className="hud-mono">Accept: application/vnd.github.raw+json</span>
            </p>
            <p className="mt-2 font-medium text-ink">Home Assistant writes (presence/environment):</p>
            <p className="hud-mono break-all">
              PUT https://api.github.com/repos/JaxsonD7/performace-ha/contents/ha-status.json
            </p>
            <p>
              With <span className="hud-mono">Contents: Read and write</span> on its own token — this app
              only ever reads that file back, never writes it.
            </p>
            <p>
              Full schema and field docs live in the repo's README:{' '}
              <a
                className="text-brand"
                href="https://github.com/JaxsonD7/performace-ha"
                target="_blank"
                rel="noreferrer"
              >
                github.com/JaxsonD7/performace-ha
              </a>
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function NotificationsCard() {
  const { state, updateSettings } = useStore();
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const permission = supported ? Notification.permission : 'denied';
  const enabled = state.settings.notificationsEnabled;

  const enable = async () => {
    setError(null);
    if (!supported) {
      setError('This browser does not support notifications.');
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      setError('Permission was not granted — check your browser/site notification settings.');
      return;
    }
    updateSettings({ notificationsEnabled: true });
  };

  return (
    <Card>
      <CardHeader
        title="Reminders"
        icon="🔔"
        action={enabled && permission === 'granted' ? <Badge tone="good">✓ On</Badge> : null}
      />
      <div className="card-pad space-y-3">
        <p className="text-xs text-ink-muted">
          Fires a browser notification a few minutes before each schedule block starts — but only
          while this tab is open. A static site has no push server, so this can't wake your phone
          from your pocket; it's for while the app is up on a screen in front of you.
        </p>
        {enabled && permission === 'granted' ? (
          <div className="flex items-center gap-3">
            <Field label="Lead time (min)" className="max-w-[8rem]">
              <TextInput
                type="number"
                min={1}
                max={60}
                value={state.settings.notificationLeadMin}
                onChange={(e) => updateSettings({ notificationLeadMin: Math.max(1, numOr(e.target.value, 5)) })}
              />
            </Field>
            <button
              type="button"
              className="btn-ghost mt-5 !py-1 text-xs"
              onClick={() => updateSettings({ notificationsEnabled: false })}
            >
              Turn off
            </button>
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void enable()}>
            Enable reminders
          </button>
        )}
        {permission === 'denied' && supported ? (
          <p className="text-xs text-critical">
            Notifications are blocked for this site — re-enable them in your browser's site settings.
          </p>
        ) : null}
        {error ? <p className="text-xs text-critical">{error}</p> : null}
      </div>
    </Card>
  );
}

function Seam({ title, path, body }: { title: string; path: string; body: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <code className="mt-1 block text-[11px] text-brand">{path}</code>
      <p className="mt-1.5 text-xs text-ink-secondary">{body}</p>
    </div>
  );
}
