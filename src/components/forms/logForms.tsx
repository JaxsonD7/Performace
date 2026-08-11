import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, IconButton, Select, TextArea, TextInput, TrashIcon } from '@/components/ui/primitives';
import { num, numOr, useFormDraft } from '@/components/forms/useFormDraft';
import { durationBetween, today } from '@/lib/date';
import { uid } from '@/lib/id';
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
  const { add, update } = useStore();
  const { draft, set } = useFormDraft<Meal>(open, () =>
    initial
      ? { ...initial }
      : { id: '', date, type: 'breakfast', name: '', clean: true, time: '' },
  );

  const save = () => {
    if (!draft.name.trim()) return;
    if (initial) update('meals', initial.id, draft);
    else add('meals', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit meal' : 'Log a meal'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.name.trim()} />}
    >
      <div className="space-y-4">
        <Field label="What did you eat?">
          <TextInput
            autoFocus
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

export function SleepForm({ open, onClose, initial, date = today() }: FormProps<SleepEntry>) {
  const { add, update, state } = useStore();
  const { draft, set } = useFormDraft<SleepEntry>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          date,
          bedtime: state.settings.bedTime,
          wakeTime: state.settings.wakeTime,
          durationMin: durationBetween(state.settings.bedTime, state.settings.wakeTime),
          quality: 3,
          source: state.settings.healthDevice,
        },
  );

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
          <Field label="Bedtime">
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
  const { draft, set, setDraft } = useFormDraft<Workout>(open, () =>
    initial
      ? { ...initial, exercises: initial.exercises.map((e) => ({ ...e, sets: [...e.sets] })) }
      : {
          id: '',
          date,
          title: '',
          type: 'push',
          status: 'planned',
          startTime: state.settings.workoutTime,
          plannedMin: 60,
          exercises: [],
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('workouts', initial.id, draft);
    else add('workouts', draft);
    onClose();
  };

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        { id: uid('ex'), name: '', targetSets: 3, targetReps: '8-10', sets: [] },
      ],
    }));

  const patchExercise = (id: string, patch: Partial<Workout['exercises'][number]>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const removeExercise = (id: string) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? 'Edit workout' : 'Plan a workout'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
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
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Exercises</span>
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={addExercise}>
              + Add exercise
            </button>
          </div>

          {draft.exercises.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
              No exercises yet — add a few and tick the sets off as you go.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="grid grid-cols-[1fr_4rem_5rem_2rem] items-end gap-2 rounded-lg border border-line p-2"
                >
                  <Field label="Exercise">
                    <TextInput
                      value={ex.name}
                      onChange={(e) => patchExercise(ex.id, { name: e.target.value })}
                      placeholder="Bench press"
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
              ))}
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
