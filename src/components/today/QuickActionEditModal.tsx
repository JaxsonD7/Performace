import { useEffect, useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, Select, TextInput } from '@/components/ui/primitives';
import { useStore } from '@/store/store';
import type { QuickAction, QuickActionType, QuickFormTarget } from '@/types';

const TYPE_LABEL: Record<QuickActionType, string> = {
  water: 'Log water',
  'photo-meal': 'Photo a meal',
  'workout-template': 'Start a workout',
  'body-weight': 'Log body weight',
  'habit-toggle': 'Check off a habit',
  'quick-form': 'Jump to a form',
  none: 'Empty',
};

const TYPE_ICON: Record<QuickActionType, string> = {
  water: '💧',
  'photo-meal': '📷',
  'workout-template': '🏋️',
  'body-weight': '⚖️',
  'habit-toggle': '✓',
  'quick-form': '➕',
  none: '·',
};

const FORM_LABEL: Record<QuickFormTarget, string> = {
  task: 'Task',
  meal: 'Meal',
  workout: 'Workout',
  reading: 'Reading session',
  meeting: 'Meeting / event',
  assignment: 'Assignment',
};

/**
 * Configures all six dock slots at once. Every slot is independent — there is
 * no fixed meaning to "slot 3", so this is just six rows, each a type picker
 * plus whatever config that type needs.
 */
export function QuickActionEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setQuickActions } = useStore();
  const [draft, setDraft] = useState<QuickAction[]>(() => state.quickActions.map((a) => ({ ...a })));

  // Rebuild the draft fresh every time the modal opens.
  useEffect(() => {
    if (open) setDraft(state.quickActions.map((a) => ({ ...a })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (i: number, next: Partial<QuickAction>) =>
    setDraft((d) => d.map((a, idx) => (idx === i ? { ...a, ...next } : a)));

  const setType = (i: number, type: QuickActionType) => {
    patch(i, {
      type,
      label: TYPE_LABEL[type] === 'Empty' ? 'Empty' : draft[i].label,
      icon: TYPE_ICON[type],
      waterDelta: type === 'water' ? (draft[i].waterDelta ?? 8) : undefined,
      templateId: type === 'workout-template' ? draft[i].templateId : undefined,
      habitId: type === 'habit-toggle' ? draft[i].habitId : undefined,
      formTarget: type === 'quick-form' ? (draft[i].formTarget ?? 'task') : undefined,
    });
  };

  const save = () => {
    setQuickActions(draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Customize your quick actions"
      footer={<ModalActions onCancel={onClose} onConfirm={save} confirmLabel="Save" />}
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-secondary">
          Six buttons, each one whatever you want. Change what any of them do any time.
        </p>
        {draft.map((a, i) => (
          <div key={a.id} className="rounded-lg border border-line p-3">
            <div className="grid grid-cols-[3rem_1fr_1fr] items-end gap-2">
              <Field label="#">
                <div className="input flex items-center justify-center text-base">{TYPE_ICON[a.type]}</div>
              </Field>
              <Field label="Action">
                <Select value={a.type} onChange={(e) => setType(i, e.target.value as QuickActionType)}>
                  {(Object.keys(TYPE_LABEL) as QuickActionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Button label">
                <TextInput value={a.label} onChange={(e) => patch(i, { label: e.target.value })} />
              </Field>
            </div>

            {a.type === 'water' ? (
              <div className="mt-2 max-w-[10rem]">
                <Field label="Ounces per tap">
                  <TextInput
                    type="number"
                    min={1}
                    value={a.waterDelta ?? 8}
                    onChange={(e) => patch(i, { waterDelta: Math.max(1, Number(e.target.value) || 8) })}
                  />
                </Field>
              </div>
            ) : null}

            {a.type === 'workout-template' ? (
              <div className="mt-2">
                <Field label="Template" hint="Leave unset to show a picker each time">
                  <Select
                    value={a.templateId ?? ''}
                    onChange={(e) => patch(i, { templateId: e.target.value || undefined })}
                  >
                    <option value="">Ask each time</option>
                    {state.workoutTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {!state.workoutTemplates.length ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    No templates saved yet — save one from any workout's "Save as template" button.
                  </p>
                ) : null}
              </div>
            ) : null}

            {a.type === 'habit-toggle' ? (
              <div className="mt-2">
                <Field label="Habit">
                  <Select
                    value={a.habitId ?? ''}
                    onChange={(e) => patch(i, { habitId: e.target.value || undefined })}
                  >
                    <option value="">Choose a habit…</option>
                    {state.habits
                      .filter((h) => !h.archived)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.icon} {h.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
            ) : null}

            {a.type === 'quick-form' ? (
              <div className="mt-2">
                <Field label="Opens">
                  <Select
                    value={a.formTarget ?? 'task'}
                    onChange={(e) => patch(i, { formTarget: e.target.value as QuickFormTarget })}
                  >
                    {(Object.keys(FORM_LABEL) as QuickFormTarget[]).map((f) => (
                      <option key={f} value={f}>
                        {FORM_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Modal>
  );
}
