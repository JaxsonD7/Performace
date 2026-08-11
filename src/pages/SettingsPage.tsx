import { useRef, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import {
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
import { useStore } from '@/store/store';
import type { CollectionKey, DataSource, Settings, ThemePreference } from '@/types';

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
  const { state, updateSettings, replaceAll, resetToSample, resetToEmpty } = useStore();
  const s = state.settings;
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<'sample' | 'empty' | null>(null);
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
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Daily rhythm"
              icon="🕰️"
              subtitle="The planner builds every day around these."
            />
            <div className="card-pad grid grid-cols-2 gap-3">
              <TimeField label="Wake up" value={s.wakeTime} onChange={(wakeTime) => updateSettings({ wakeTime })} />
              <TimeField label="Bed time" value={s.bedTime} onChange={(bedTime) => updateSettings({ bedTime })} />
              <TimeField label="Breakfast" value={s.breakfastTime} onChange={(breakfastTime) => updateSettings({ breakfastTime })} />
              <TimeField label="Lunch" value={s.lunchTime} onChange={(lunchTime) => updateSettings({ lunchTime })} />
              <TimeField label="Dinner" value={s.dinnerTime} onChange={(dinnerTime) => updateSettings({ dinnerTime })} />
              <TimeField label="Workout" value={s.workoutTime} onChange={(workoutTime) => updateSettings({ workoutTime })} />
              <TimeField label="Reading" value={s.readingTime} onChange={(readingTime) => updateSettings({ readingTime })} />
              <TimeField label="School starts" value={s.schoolStart} onChange={(schoolStart) => updateSettings({ schoolStart })} />
              <TimeField label="School ends" value={s.schoolEnd} onChange={(schoolEnd) => updateSettings({ schoolEnd })} />
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
              <Field label="Water (cups/day)">
                <TextInput
                  type="number"
                  value={s.waterGoalCups}
                  onChange={(e) => setNumber('waterGoalCups', 8)(e.target.value)}
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
                  {state.meetings.length} events · {state.goals.length} goals ·{' '}
                  {state.health.length} health days
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

              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" className="btn-ghost" onClick={() => setConfirm('sample')}>
                  Reset to sample data
                </button>
                <button
                  type="button"
                  className="btn text-critical hover:bg-critical/10"
                  onClick={() => setConfirm('empty')}
                >
                  Erase everything
                </button>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="What comes next" icon="🔌" subtitle="Where each future feature plugs in." />
          <div className="card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Seam
              title="Apple Watch Ultra import"
              path="src/integrations/health"
              body="Export from Health on iPhone, parse the XML, merge days into the health table."
            />
            <Seam
              title="Calendar import"
              path="src/integrations/calendar"
              body="Parse .ics into Meetings; the planner already treats them as fixed."
            />
            <Seam
              title="Notifications"
              path="src/integrations/notifications"
              body="Turn today's blocks into reminders once permission is granted."
            />
            <Seam
              title="AI daily schedules"
              path="src/integrations/ai"
              body="Implement DayPlanner.plan and the pages pick it up unchanged."
            />
            <Seam
              title="Charts & reports"
              path="src/components/ui/charts.tsx"
              body="Bars, tiles, and week dots are shared primitives — new charts reuse them."
            />
            <Seam
              title="CSV / PDF export"
              path="src/integrations/export"
              body="CSV works now; PDF goes through the browser's print dialog."
            />
          </div>
        </Card>
      </PageBody>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'sample' ? 'Reset to sample data?' : 'Erase everything?'}
        footer={
          <ModalActions
            onCancel={() => setConfirm(null)}
            destructive
            confirmLabel={confirm === 'sample' ? 'Reset' : 'Erase'}
            onConfirm={() => {
              if (confirm === 'sample') resetToSample();
              else resetToEmpty();
              setConfirm(null);
              setMessage(confirm === 'sample' ? 'Sample data restored.' : 'All data erased.');
            }}
          />
        }
      >
        <p className="text-sm text-ink-secondary">
          {confirm === 'sample'
            ? 'This replaces everything currently saved with the two-week sample. Export a backup first if you want to keep what you have.'
            : 'This deletes every task, habit log, meal, workout, and reading session in this browser. The default checklist and Orthodox rule are kept so the app still works. This cannot be undone.'}
        </p>
      </Modal>
    </>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <TextInput type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
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
