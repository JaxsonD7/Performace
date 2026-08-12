import { useRef, useState } from 'react';
import {
  AssignmentForm,
  MeetingForm,
  TaskForm,
} from '@/components/forms/entryForms';
import { MealForm, ReadingForm, WorkoutForm } from '@/components/forms/logForms';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, IconButton, PencilIcon, TextInput, cx } from '@/components/ui/primitives';
import { showToast } from '@/components/ui/Toast';
import { QuickActionEditModal } from '@/components/today/QuickActionEditModal';
import { compressPhoto, analyzeFoodPhoto } from '@/integrations/vision/claude';
import { today } from '@/lib/date';
import { uid } from '@/lib/id';
import { useHabitToggle } from '@/store/actions';
import { useStore } from '@/store/store';
import type { QuickAction, QuickFormTarget, Workout } from '@/types';

const mealTypeNow = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
};

/**
 * Six one-tap logging buttons, shown at the top of Today so it's the first
 * thing there is to interact with. Each slot is independently configurable —
 * see `QuickActionEditModal` — and the same component and data drive it on
 * phone and laptop alike; only the grid's column count adapts to the screen.
 */
export function QuickActionDock() {
  const { state, update, updateDay, add } = useStore();
  const toggleHabit = useHabitToggle();
  const [editOpen, setEditOpen] = useState(false);
  const [weightSlot, setWeightSlot] = useState(false);
  const [templatePickerFor, setTemplatePickerFor] = useState<QuickAction | null>(null);
  const [formModal, setFormModal] = useState<QuickFormTarget | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const pendingPhotoAction = useRef<QuickAction | null>(null);

  const date = today();
  const todayLog = state.days.find((d) => d.date === date);

  const startWorkoutFromTemplate = (templateId: string) => {
    const tpl = state.workoutTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    const workout: Omit<Workout, 'id'> = {
      date,
      title: tpl.name,
      type: tpl.type,
      status: 'planned',
      plannedMin: 60,
      exercises: tpl.exercises.map((e) => ({
        id: uid('ex'),
        name: e.name,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        sets: Array.from({ length: e.targetSets }, () => ({ reps: 0, done: false })),
      })),
    };
    add('workouts', workout);
    showToast(`🏋️ Started ${tpl.name}`);
  };

  const runPhotoAction = async (file: File) => {
    const photo = await compressPhoto(file);
    const id = add('meals', {
      date,
      type: mealTypeNow(),
      name: 'Meal',
      time: new Date().toTimeString().slice(0, 5),
      clean: true,
      photo,
      analyzed: false,
    });
    showToast('📷 Photo saved');

    const key = state.settings.anthropicApiKey;
    if (!key) return;
    try {
      const result = await analyzeFoodPhoto(photo, key);
      update('meals', id, {
        name: result.name,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        analyzed: true,
      });
      showToast(`✨ ${result.name}`);
    } catch {
      // Photo is already saved either way — analysis is a bonus, not a
      // requirement, so a failed call here stays silent rather than
      // interrupting a quick-log flow with an error about something optional.
    }
  };

  const run = (a: QuickAction) => {
    switch (a.type) {
      case 'water': {
        const next = (todayLog?.waterCups ?? 0) + (a.waterDelta ?? 1);
        updateDay(date, { waterCups: next });
        showToast(`💧 Water ${next} cups`);
        return;
      }
      case 'photo-meal':
        pendingPhotoAction.current = a;
        photoInput.current?.click();
        return;
      case 'workout-template':
        if (a.templateId) startWorkoutFromTemplate(a.templateId);
        else setTemplatePickerFor(a);
        return;
      case 'body-weight':
        setWeightSlot(true);
        return;
      case 'habit-toggle': {
        if (!a.habitId) {
          setEditOpen(true);
          return;
        }
        const habit = state.habits.find((h) => h.id === a.habitId);
        toggleHabit(a.habitId, date);
        showToast(`✓ ${habit?.name ?? 'Habit'}`);
        return;
      }
      case 'quick-form':
        setFormModal(a.formTarget ?? 'task');
        return;
      case 'none':
      default:
        setEditOpen(true);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Quick log</p>
        <IconButton onClick={() => setEditOpen(true)} label="Customize quick actions">
          <PencilIcon />
        </IconButton>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {state.quickActions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => run(a)}
            className={cx(
              'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors',
              a.type === 'none'
                ? 'border-dashed border-line text-ink-muted hover:border-brand/40'
                : 'border-line bg-raised text-ink hover:border-brand/40 hover:bg-brand/5 active:bg-brand/10',
            )}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {a.icon}
            </span>
            <span className="max-w-full truncate text-[11px] font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void runPhotoAction(file);
        }}
      />

      <QuickActionEditModal open={editOpen} onClose={() => setEditOpen(false)} />

      <WeightQuickModal open={weightSlot} onClose={() => setWeightSlot(false)} />

      <TemplatePickerModal
        action={templatePickerFor}
        onClose={() => setTemplatePickerFor(null)}
        onPick={(id) => {
          startWorkoutFromTemplate(id);
          setTemplatePickerFor(null);
        }}
      />

      <TaskForm open={formModal === 'task'} onClose={() => setFormModal(null)} date={date} />
      <MealForm open={formModal === 'meal'} onClose={() => setFormModal(null)} date={date} />
      <WorkoutForm open={formModal === 'workout'} onClose={() => setFormModal(null)} date={date} />
      <ReadingForm open={formModal === 'reading'} onClose={() => setFormModal(null)} date={date} />
      <MeetingForm open={formModal === 'meeting'} onClose={() => setFormModal(null)} date={date} />
      <AssignmentForm open={formModal === 'assignment'} onClose={() => setFormModal(null)} />
    </div>
  );
}

function WeightQuickModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, add, update } = useStore();
  const [value, setValue] = useState('');
  const unit = state.settings.weightUnit;
  const date = today();

  const save = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    const existing = state.health.find((h) => h.date === date);
    if (existing) update('health', existing.id, { bodyWeight: n });
    else add('health', { date, bodyWeight: n, source: state.settings.healthDevice });
    showToast(`⚖️ ${n} ${unit}`);
    setValue('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log weight"
      footer={<ModalActions onCancel={onClose} onConfirm={save} confirmLabel="Save" disabled={!value} />}
    >
      <Field label={`Weight (${unit})`}>
        <TextInput
          autoFocus
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
    </Modal>
  );
}

function TemplatePickerModal({
  action,
  onClose,
  onPick,
}: {
  action: QuickAction | null;
  onClose: () => void;
  onPick: (templateId: string) => void;
}) {
  const { state } = useStore();
  const [blankOpen, setBlankOpen] = useState(false);

  if (blankOpen) {
    return (
      <WorkoutForm
        open
        onClose={() => {
          setBlankOpen(false);
          onClose();
        }}
        date={today()}
      />
    );
  }

  return (
    <Modal open={!!action} onClose={onClose} title="Start which workout?">
      {state.workoutTemplates.length ? (
        <ul className="divide-y divide-line">
          {state.workoutTemplates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-raised"
              >
                <span className="text-sm text-ink">{t.name}</span>
                <span className="text-xs text-ink-muted">{t.exercises.length} exercises</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-sm text-ink-secondary">
            No saved templates yet. Plan a workout and use its "Save as template" button to get
            one-tap starts here next time.
          </p>
          <button type="button" className="btn-primary" onClick={() => setBlankOpen(true)}>
            Plan a workout now
          </button>
        </div>
      )}
    </Modal>
  );
}
