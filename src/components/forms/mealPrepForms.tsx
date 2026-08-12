import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, TextArea, TextInput } from '@/components/ui/primitives';
import { num, numOr, useFormDraft } from '@/components/forms/useFormDraft';
import { today } from '@/lib/date';
import { useStore } from '@/store/store';
import type { MealPrepBatch } from '@/types';

/**
 * A batch you cooked once and are eating from all week — the whole point is
 * that logging a serving later takes one tap, not re-entering macros for the
 * fourth "chicken and rice" of the week.
 */
export function MealPrepForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: MealPrepBatch;
}) {
  const { add, update, remove } = useStore();
  const { draft, set } = useFormDraft<MealPrepBatch>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          name: '',
          caloriesPerServing: 0,
          totalServings: 4,
          servingsLeft: 4,
          madeOn: today(),
        },
  );

  const save = () => {
    if (!draft.name.trim() || draft.caloriesPerServing <= 0) return;
    if (initial) update('mealPrepBatches', initial.id, draft);
    else add('mealPrepBatches', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit meal prep batch' : 'Log a meal prep batch'}
      footer={
        <>
          {initial ? (
            <button
              type="button"
              className="btn text-critical hover:bg-critical/10"
              onClick={() => {
                remove('mealPrepBatches', initial.id);
                onClose();
              }}
            >
              Delete
            </button>
          ) : null}
          <span className="flex-1" />
          <ModalActions
            onCancel={onClose}
            onConfirm={save}
            disabled={!draft.name.trim() || draft.caloriesPerServing <= 0}
          />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <TextInput
            autoFocus
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Chicken, rice & broccoli"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Made on">
            <TextInput type="date" value={draft.madeOn} onChange={(e) => set('madeOn', e.target.value)} />
          </Field>
          <Field label="Total servings">
            <TextInput
              type="number"
              min={1}
              value={draft.totalServings}
              onChange={(e) => {
                const total = Math.max(1, numOr(e.target.value, 1));
                const usedSoFar = initial ? initial.totalServings - initial.servingsLeft : 0;
                set('totalServings', total);
                set('servingsLeft', Math.max(0, total - usedSoFar));
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories / serving">
            <TextInput
              type="number"
              min={0}
              value={draft.caloriesPerServing}
              onChange={(e) => set('caloriesPerServing', numOr(e.target.value, 0))}
            />
          </Field>
          <Field label="Protein / serving (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.proteinPerServing ?? ''}
              onChange={(e) => set('proteinPerServing', num(e.target.value))}
            />
          </Field>
          <Field label="Carbs / serving (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.carbsPerServing ?? ''}
              onChange={(e) => set('carbsPerServing', num(e.target.value))}
            />
          </Field>
          <Field label="Fat / serving (g)">
            <TextInput
              type="number"
              min={0}
              value={draft.fatPerServing ?? ''}
              onChange={(e) => set('fatPerServing', num(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
        </Field>
      </div>
    </Modal>
  );
}
