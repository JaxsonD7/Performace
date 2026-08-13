import { useRef, useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, IconButton, Select, TextArea, TextInput, TrashIcon, cx } from '@/components/ui/primitives';
import { num, numOr, useFormDraft } from '@/components/forms/useFormDraft';
import { ExerciseInput, useRememberExercise } from '@/components/lifting/ExerciseInput';
import { durationBetween, today } from '@/lib/date';
import { uid } from '@/lib/id';
import { lastPerformance, personalBest, summarizeSets } from '@/lib/lifting';
import { fastingStatus } from '@/lib/orthodoxCalendar';
import { routineOn } from '@/lib/routine';
import { analyzeFoodPhoto, compressPhoto, VisionError } from '@/integrations/vision/claude';
import { useStore } from '@/store/store';
import type {
  Book,
  HealthMetric,
  ISODate,
  Meal,
  ReadingSession,
  ScheduleBlock,
  SleepEntry,
  Workout,
} from '@/types';

interface FormProps<T> {
  open: boolean;
  onClose: () => void;
  initial?: T;
  date?: ISODate;
}

// ---------------------------------------------------------------------------
// Meal
// ---------------------------------------------------------------------------

export function MealForm({ open, onClose, initial, date = today() }: FormProps<Meal>) {
  const { add, update, state } = useStore();
  const { draft, set, setDraft } = useFormDraft<Meal>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          date,
          type: 'breakfast',
          name: '',
          clean: true,
          time: '',
          fasting: fastingStatus(date, state.settings.orthodoxCalendar).fasting,
        },
  );
  const todayFast = fastingStatus(draft.date, state.settings.orthodoxCalendar);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNoteText] = useState<string | null>(null);
  const hasKey = !!state.settings.anthropicApiKey;

  const save = () => {
    if (!draft.name.trim()) return;
    if (initial) update('meals', initial.id, draft);
    else add('meals', draft);
    onClose();
  };

  const onPhoto = async (file: File) => {
    setError(null);
    setNoteText(null);
    try {
      const photo = await compressPhoto(file);
      setDraft((d) => ({ ...d, photo, analyzed: false }));
    } catch {
      setError('Could not read that photo.');
    }
  };

  const analyze = async () => {
    if (!draft.photo) return;
    setBusy(true);
    setError(null);
    setNoteText(null);
    try {
      const result = await analyzeFoodPhoto(draft.photo, state.settings.anthropicApiKey ?? '');
      setDraft((d) => ({
        ...d,
        name: d.name.trim() ? d.name : result.name,
        calories: result.calories ?? d.calories,
        protein: result.protein ?? d.protein,
        carbs: result.carbs ?? d.carbs,
        fat: result.fat ?? d.fat,
        analyzed: true,
      }));
      if (result.note) setNoteText(result.note);
    } catch (err) {
      setError(err instanceof VisionError ? err.message : 'Something went wrong analyzing that photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit meal' : 'Log a meal'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.name.trim()} />}
    >
      <div className="space-y-4">
        <div>
          <span className="label">Photo</span>
          {draft.photo ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              <img src={draft.photo} alt="" className="max-h-56 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/50 p-2 backdrop-blur-sm">
                <button
                  type="button"
                  className="btn-quiet !py-1 text-xs text-white hover:bg-white/10"
                  onClick={() => setDraft((d) => ({ ...d, photo: undefined, analyzed: false }))}
                >
                  Remove
                </button>
                {hasKey ? (
                  <button
                    type="button"
                    className="btn-primary !py-1 text-xs"
                    onClick={() => void analyze()}
                    disabled={busy}
                  >
                    {busy ? 'Analyzing…' : draft.analyzed ? 'Re-analyze' : '✨ Analyze with Claude'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-6 text-sm text-ink-muted hover:border-brand/40 hover:text-ink-secondary"
              onClick={() => fileInput.current?.click()}
            >
              📷 Add a photo
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPhoto(file);
              e.target.value = '';
            }}
          />
          {!hasKey && draft.photo ? (
            <p className="mt-1.5 text-xs text-ink-muted">
              Add an Anthropic API key in Settings to analyze photos automatically.
            </p>
          ) : null}
          {error ? <p className="mt-1.5 text-xs text-critical">{error}</p> : null}
          {note ? <p className="mt-1.5 text-xs text-ink-muted">Claude's note: {note}</p> : null}
        </div>

        <Field label="What did you eat?">
          <TextInput
            autoFocus={!draft.photo}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Chicken, rice, broccoli"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Meal">
            <Select value={draft.type} onChange={(e) => set('type', e.target.value as Meal['type'])}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </Select>
          </Field>
          <Field label="Time">
            <TextInput
              type="time"
              value={draft.time ?? ''}
              onChange={(e) => set('time', e.target.value || undefined)}
            />
          </Field>
          <Field label="Calories">
            <TextInput
              type="number"
              min={0}
              value={draft.calories ?? ''}
              onChange={(e) => set('calories', num(e.target.value))}
            />
          </Field>
          <Field label="Protein (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.protein ?? ''}
              onChange={(e) => set('protein', num(e.target.value))}
            />
          </Field>
          <Field label="Carbs (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.carbs ?? ''}
              onChange={(e) => set('carbs', num(e.target.value))}
            />
          </Field>
          <Field label="Fat (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.fat ?? ''}
              onChange={(e) => set('fat', num(e.target.value))}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={draft.clean}
              onChange={(e) => set('clean', e.target.checked)}
              className="h-4 w-4 rounded border-line accent-[rgb(var(--series-1))]"
            />
            This fit the plan (counts toward eating clean)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={draft.fasting ?? false}
              onChange={(e) => set('fasting', e.target.checked)}
              className="h-4 w-4 rounded border-line accent-[rgb(var(--series-1))]"
            />
            Kept the fast
          </label>
          {todayFast.fasting ? (
            <p className="pl-6 text-xs text-ink-muted">
              {draft.date} is a fasting day{todayFast.label ? ` — ${todayFast.label}` : ''}.
            </p>
          ) : null}
        </div>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

/** ISO datetime -> local "HH:MM", for turning haStatus.lights_off_at into a bedtime suggestion. */
function toLocalClock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SleepForm({ open, onClose, initial, date = today() }: FormProps<SleepEntry>) {
  const { add, update, state, haStatus } = useStore();
  // Only a suggestion, never auto-logged — same rule as everything else in
  // this app. It just replaces the routine-default bedtime on a *new* entry
  // when Home Assistant knows when the lights actually went out; editing an
  // existing entry never touches it, and the field stays fully editable.
  const suggestedBedtime = !initial && haStatus?.lights_off_at ? toLocalClock(haStatus.lights_off_at) : null;

  const { draft, set } = useFormDraft<SleepEntry>(open, () => {
    const routine = routineOn(state.settings, date);
    return initial
      ? { ...initial }
      : {
          id: '',
          date,
          bedtime: suggestedBedtime ?? routine.bedTime,
          wakeTime: routine.wakeTime,
          durationMin: durationBetween(suggestedBedtime ?? routine.bedTime, routine.wakeTime),
          quality: 3,
          source: state.settings.healthDevice,
        };
  });

  // Duration is always derived from the two clock times, so the trend charts
  // never disagree with what was entered.
  const durationMin = durationBetween(draft.bedtime, draft.wakeTime);

  const save = () => {
    const record = { ...draft, durationMin };
    if (initial) update('sleep', initial.id, record);
    else add('sleep', record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit sleep' : 'Log sleep'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date (morning you woke)">
            <TextInput
              type="date"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label="Source">
            <Select
              value={draft.source}
              onChange={(e) => set('source', e.target.value as SleepEntry['source'])}
            >
              <option value="apple-watch">Apple Watch</option>
              <option value="apple-health">Apple Health</option>
              <option value="manual">Manual</option>
              <option value="garmin">Garmin</option>
              <option value="fitbit">Fitbit</option>
            </Select>
          </Field>
          <Field
            label="Bedtime"
            hint={suggestedBedtime ? '🏠 Suggested from when your lights went out — edit freely' : undefined}
          >
            <TextInput
              type="time"
              value={draft.bedtime}
              onChange={(e) => set('bedtime', e.target.value)}
            />
          </Field>
          <Field label="Wake time">
            <TextInput
              type="time"
              value={draft.wakeTime}
              onChange={(e) => set('wakeTime', e.target.value)}
            />
          </Field>
        </div>

        <p className="rounded-lg bg-raised px-3 py-2 text-sm text-ink-secondary">
          Time asleep:{' '}
          <span className="font-semibold tabular-nums text-ink">
            {Math.floor(durationMin / 60)}h {durationMin % 60}m
          </span>
        </p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Quality">
            <Select
              value={String(draft.quality)}
              onChange={(e) => set('quality', Number(e.target.value) as SleepEntry['quality'])}
            >
              <option value="1">1 — rough</option>
              <option value="2">2</option>
              <option value="3">3 — ok</option>
              <option value="4">4</option>
              <option value="5">5 — great</option>
            </Select>
          </Field>
          <Field label="Resting HR">
            <TextInput
              type="number"
              value={draft.restingHr ?? ''}
              onChange={(e) => set('restingHr', num(e.target.value))}
            />
          </Field>
          <Field label="HRV (ms)">
            <TextInput
              type="number"
              value={draft.hrv ?? ''}
              onChange={(e) => set('hrv', num(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Workout — plan and log in one form
// ---------------------------------------------------------------------------

export function WorkoutForm({ open, onClose, initial, date = today() }: FormProps<Workout>) {
  const { add, update, state } = useStore();
  const rememberExercise = useRememberExercise();
  const [templateSaved, setTemplateSaved] = useState(false);

  const { draft, set, setDraft } = useFormDraft<Workout>(open, () =>
    initial
      ? { ...initial, exercises: initial.exercises.map((e) => ({ ...e, sets: [...e.sets] })) }
      : {
          id: '',
          date,
          title: '',
          type: 'push',
          status: 'planned',
          startTime: routineOn(state.settings, date).workoutTime ?? '16:00',
          plannedMin: 60,
          exercises: [],
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    draft.exercises.forEach((e) => rememberExercise(e.name));
    if (initial) update('workouts', initial.id, draft);
    else add('workouts', draft);
    onClose();
  };

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          id: uid('ex'),
          name: '',
          targetSets: 3,
          targetReps: '8-10',
          // Pre-populated to match targetSets, not left empty — otherwise the
          // per-set weight/reps editor below has nothing to show until you
          // happen to re-touch the Sets field.
          sets: Array.from({ length: 3 }, () => ({ reps: 0, done: false })),
        },
      ],
    }));

  const patchExercise = (id: string, patch: Partial<Workout['exercises'][number]>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const removeExercise = (id: string) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));

  const applyTemplate = (templateId: string) => {
    const tpl = state.workoutTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraft((d) => ({
      ...d,
      title: d.title || tpl.name,
      type: tpl.type,
      exercises: tpl.exercises.map((e) => ({
        id: uid('ex'),
        name: e.name,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        sets: Array.from({ length: e.targetSets }, () => ({ reps: 0, done: false })),
      })),
    }));
  };

  const saveAsTemplate = () => {
    if (!draft.title.trim() || !draft.exercises.length) return;
    add('workoutTemplates', {
      name: draft.title.trim(),
      type: draft.type,
      exercises: draft.exercises.map((e) => ({
        name: e.name,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
      })),
      createdAt: new Date().toISOString(),
    });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? 'Edit workout' : 'Plan a workout'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        {!initial && state.workoutTemplates.length ? (
          <Field label="Start from a template" hint="Fills in the exercise list — nothing is saved until you press Save">
            <Select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
              <option value="">Choose a template…</option>
              {state.workoutTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.exercises.length} exercises)
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" className="col-span-2">
            <TextInput
              autoFocus
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Push day"
            />
          </Field>
          <Field label="Type">
            <Select value={draft.type} onChange={(e) => set('type', e.target.value as Workout['type'])}>
              {['push', 'pull', 'legs', 'upper', 'lower', 'full-body', 'cardio', 'mobility', 'sport', 'rest'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Workout['status'])}
            >
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
            </Select>
          </Field>
          <Field label="Date">
            <TextInput type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Start time">
            <TextInput
              type="time"
              value={draft.startTime ?? ''}
              onChange={(e) => set('startTime', e.target.value || undefined)}
            />
          </Field>
          <Field label="Planned (min)">
            <TextInput
              type="number"
              min={5}
              step={5}
              value={draft.plannedMin}
              onChange={(e) => set('plannedMin', numOr(e.target.value, 60))}
            />
          </Field>
          <Field label="Actual (min)">
            <TextInput
              type="number"
              min={0}
              step={5}
              value={draft.actualMin ?? ''}
              onChange={(e) => set('actualMin', num(e.target.value))}
            />
          </Field>
          <Field label="Avg HR">
            <TextInput
              type="number"
              value={draft.avgHr ?? ''}
              onChange={(e) => set('avgHr', num(e.target.value))}
            />
          </Field>
          <Field label="Active calories">
            <TextInput
              type="number"
              value={draft.activeCalories ?? ''}
              onChange={(e) => set('activeCalories', num(e.target.value))}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="label mb-0">Exercises</span>
            <div className="flex items-center gap-2">
              {templateSaved ? <span className="text-xs text-good">Saved as template</span> : null}
              {draft.exercises.length ? (
                <button type="button" className="btn-quiet !py-1 text-xs" onClick={saveAsTemplate}>
                  Save as template
                </button>
              ) : null}
              <button type="button" className="btn-ghost !py-1 text-xs" onClick={addExercise}>
                + Add exercise
              </button>
            </div>
          </div>

          {draft.exercises.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
              No exercises yet — add a few and tick the sets off as you go.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.exercises.map((ex) => {
                const last = ex.name.trim() ? lastPerformance(state, ex.name, draft.date) : undefined;
                const best = ex.name.trim() ? personalBest(state, ex.name, draft.date) : undefined;
                return (
                  <div key={ex.id} className="rounded-lg border border-line p-2">
                    <div className="grid grid-cols-[1fr_4rem_5rem_2rem] items-end gap-2">
                      <Field label="Exercise">
                        <ExerciseInput
                          value={ex.name}
                          onChange={(name) => patchExercise(ex.id, { name })}
                        />
                      </Field>
                      <Field label="Sets">
                        <TextInput
                          type="number"
                          min={1}
                          value={ex.targetSets}
                          onChange={(e) => {
                            const targetSets = numOr(e.target.value, 3);
                            const sets = Array.from(
                              { length: targetSets },
                              (_, i) => ex.sets[i] ?? { reps: 0, done: false },
                            );
                            patchExercise(ex.id, { targetSets, sets });
                          }}
                        />
                      </Field>
                      <Field label="Reps">
                        <TextInput
                          value={ex.targetReps}
                          onChange={(e) => patchExercise(ex.id, { targetReps: e.target.value })}
                          placeholder="8-10"
                        />
                      </Field>
                      <IconButton onClick={() => removeExercise(ex.id)} label="Remove exercise" tone="danger">
                        <TrashIcon />
                      </IconButton>
                    </div>
                    {last || best ? (
                      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                        {last ? (
                          <span>
                            Last time: {summarizeSets(last.sets, state.settings.weightUnit)}
                          </span>
                        ) : null}
                        {best ? (
                          <span>
                            PR: {best.weight}
                            {state.settings.weightUnit}×{best.reps}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {ex.sets.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ex.sets.map((s, i) => (
                          <div
                            key={i}
                            className={cx(
                              'flex items-center gap-1 rounded-md border px-1.5 py-1',
                              s.done ? 'border-s2 bg-s2/10' : 'border-line',
                            )}
                          >
                            <span className="w-3 text-center text-[10px] text-ink-muted">{i + 1}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={s.weight ?? ''}
                              onChange={(ev) => {
                                const sets = ex.sets.map((set, si) =>
                                  si === i ? { ...set, weight: ev.target.valueAsNumber || undefined } : set,
                                );
                                patchExercise(ex.id, { sets });
                              }}
                              placeholder="0"
                              aria-label={`${ex.name || 'Exercise'} set ${i + 1} weight`}
                              className="w-10 rounded border-0 bg-transparent text-right text-xs tabular-nums text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                            />
                            <span className="text-[10px] text-ink-muted">{state.settings.weightUnit}×</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={s.reps || ''}
                              onChange={(ev) => {
                                const sets = ex.sets.map((set, si) =>
                                  si === i ? { ...set, reps: ev.target.valueAsNumber || 0 } : set,
                                );
                                patchExercise(ex.id, { sets });
                              }}
                              placeholder="0"
                              aria-label={`${ex.name || 'Exercise'} set ${i + 1} reps`}
                              className="w-8 rounded border-0 bg-transparent text-right text-xs tabular-nums text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const sets = ex.sets.map((set, si) =>
                                  si === i ? { ...set, done: !set.done } : set,
                                );
                                patchExercise(ex.id, { sets });
                              }}
                              aria-label={`Mark ${ex.name || 'exercise'} set ${i + 1} done`}
                              aria-pressed={s.done}
                              className={cx(
                                'flex h-5 w-5 items-center justify-center rounded transition-colors',
                                s.done ? 'bg-s2 text-white' : 'border border-line text-ink-muted',
                              )}
                            >
                              {s.done ? '✓' : ''}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reading session
// ---------------------------------------------------------------------------

export function ReadingForm({ open, onClose, initial, date = today() }: FormProps<ReadingSession>) {
  const { add, update, state } = useStore();
  const { draft, set, setDraft } = useFormDraft<ReadingSession>(open, () =>
    initial
      ? { ...initial }
      : { id: '', date, title: '', kind: 'spiritual', minutes: 20 },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('reading', initial.id, draft);
    else add('reading', draft);

    // Reading a tracked book moves its bookmark, so the shelf stays honest.
    if (draft.bookId && draft.pages) {
      const book = state.books.find((b) => b.id === draft.bookId);
      if (book) {
        const alreadyCounted = initial?.bookId === draft.bookId ? (initial.pages ?? 0) : 0;
        update('books', book.id, {
          currentPage: Math.max(0, book.currentPage + draft.pages - alreadyCounted),
        });
      }
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit reading' : 'Log reading'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Book">
          <Select
            value={draft.bookId ?? ''}
            onChange={(e) => {
              const book = state.books.find((b) => b.id === e.target.value);
              setDraft((d) => ({
                ...d,
                bookId: book?.id,
                title: book ? book.title : d.title,
                kind: book ? book.kind : d.kind,
              }));
            }}
          >
            <option value="">Not from my shelf</option>
            {state.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <TextInput
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="The Way of a Pilgrim"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => set('kind', e.target.value as ReadingSession['kind'])}
            >
              <option value="scripture">Scripture</option>
              <option value="spiritual">Spiritual</option>
              <option value="school">School</option>
              <option value="general">General</option>
            </Select>
          </Field>
          <Field label="Date">
            <TextInput type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Minutes">
            <TextInput
              type="number"
              min={1}
              value={draft.minutes}
              onChange={(e) => set('minutes', numOr(e.target.value, 20))}
            />
          </Field>
          <Field label="Pages">
            <TextInput
              type="number"
              min={0}
              value={draft.pages ?? ''}
              onChange={(e) => set('pages', num(e.target.value))}
            />
          </Field>
        </div>

        <Field label="What stood out?">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

export function BookForm({ open, onClose, initial }: FormProps<Book>) {
  const { add, update } = useStore();
  const { draft, set } = useFormDraft<Book>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          title: '',
          kind: 'spiritual',
          currentPage: 0,
          status: 'reading',
          startedAt: today(),
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('books', initial.id, draft);
    else add('books', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit book' : 'Add a book'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Title">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="The Way of a Pilgrim"
          />
        </Field>
        <Field label="Author">
          <TextInput
            value={draft.author ?? ''}
            onChange={(e) => set('author', e.target.value || undefined)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={draft.kind} onChange={(e) => set('kind', e.target.value as Book['kind'])}>
              <option value="scripture">Scripture</option>
              <option value="spiritual">Spiritual</option>
              <option value="school">School</option>
              <option value="general">General</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Book['status'])}
            >
              <option value="reading">Reading</option>
              <option value="queued">Up next</option>
              <option value="paused">Paused</option>
              <option value="finished">Finished</option>
            </Select>
          </Field>
          <Field label="Current page">
            <TextInput
              type="number"
              min={0}
              value={draft.currentPage}
              onChange={(e) => set('currentPage', numOr(e.target.value, 0))}
            />
          </Field>
          <Field label="Total pages">
            <TextInput
              type="number"
              min={0}
              value={draft.totalPages ?? ''}
              onChange={(e) => set('totalPages', num(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Watch / health metrics
// ---------------------------------------------------------------------------

export function HealthForm({ open, onClose, initial, date = today() }: FormProps<HealthMetric>) {
  const { add, update, state } = useStore();
  const { draft, set } = useFormDraft<HealthMetric>(open, () =>
    initial ? { ...initial } : { id: '', date, source: state.settings.healthDevice },
  );

  const save = () => {
    if (initial) update('health', initial.id, draft);
    else add('health', draft);
    onClose();
  };

  const fields: [keyof HealthMetric, string][] = [
    ['steps', 'Steps'],
    ['activeCalories', 'Active calories'],
    ['exerciseMin', 'Exercise minutes'],
    ['standHours', 'Stand hours'],
    ['restingHr', 'Resting HR'],
    ['hrv', 'HRV (ms)'],
    ['vo2max', 'VO₂ max'],
    ['respiratoryRate', 'Respiratory rate'],
    ['wristTempDelta', 'Wrist temp Δ'],
    ['bodyWeight', 'Body weight'],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit health metrics' : 'Log health metrics'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Source">
            <Select
              value={draft.source}
              onChange={(e) => set('source', e.target.value as HealthMetric['source'])}
            >
              <option value="apple-watch">Apple Watch</option>
              <option value="apple-health">Apple Health</option>
              <option value="manual">Manual</option>
              <option value="garmin">Garmin</option>
              <option value="fitbit">Fitbit</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              <TextInput
                type="number"
                step="any"
                value={(draft[key] as number | undefined) ?? ''}
                onChange={(e) => set(key, num(e.target.value) as HealthMetric[typeof key])}
              />
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Schedule block
// ---------------------------------------------------------------------------

export function BlockForm({ open, onClose, initial, date = today() }: FormProps<ScheduleBlock>) {
  const { add, update } = useStore();
  const { draft, set } = useFormDraft<ScheduleBlock>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          date,
          start: '09:00',
          end: '10:00',
          title: '',
          kind: 'task',
          source: { type: 'manual' },
          completed: false,
          manual: true,
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    // Any hand-edited block becomes manual, which protects it from regenerate.
    const record = { ...draft, manual: true };
    if (initial) update('blocks', initial.id, record);
    else add('blocks', record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit block' : 'Add a block'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="What is this block?">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Study — Chemistry lab report"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start">
            <TextInput type="time" value={draft.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="End">
            <TextInput type="time" value={draft.end} onChange={(e) => set('end', e.target.value)} />
          </Field>
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => set('kind', e.target.value as ScheduleBlock['kind'])}
            >
              {['prayer', 'school', 'workout', 'reading', 'meal', 'meeting', 'task', 'routine', 'free', 'sleep'].map(
                (k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ),
              )}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
        <p className="text-xs text-ink-muted">
          Hand-made blocks are kept when you regenerate the day.
        </p>
      </div>
    </Modal>
  );
}
