import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, Select, TextArea, TextInput } from '@/components/ui/primitives';
import { numOr, useFormDraft } from '@/components/forms/useFormDraft';
import { useStore } from '@/store/store';
import type { PantryCategory, PantryItem, ShoppingListItem } from '@/types';

const CATEGORY_LABEL: Record<PantryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  grain: 'Grain',
  dairy: 'Dairy',
  frozen: 'Frozen',
  pantry: 'Pantry',
  other: 'Other',
};

export function PantryItemForm({
  open,
  onClose,
  initial,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  initial?: PantryItem;
  /** Seeds a *new* item's draft (e.g. from a barcode scan) — ignored when editing an existing one. Nothing here is saved until the user confirms. */
  prefill?: Partial<PantryItem>;
}) {
  const { add, update, remove } = useStore();
  const { draft, set } = useFormDraft<PantryItem>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          name: '',
          category: 'pantry',
          quantity: 1,
          unit: 'count',
          updatedAt: new Date().toISOString(),
          ...prefill,
        },
  );

  const save = () => {
    if (!draft.name.trim()) return;
    const record = { ...draft, updatedAt: new Date().toISOString() };
    if (initial) update('pantryItems', initial.id, record);
    else add('pantryItems', record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit pantry item' : 'Add a pantry item'}
      footer={
        <>
          {initial ? (
            <button
              type="button"
              className="btn text-critical hover:bg-critical/10"
              onClick={() => {
                remove('pantryItems', initial.id);
                onClose();
              }}
            >
              Delete
            </button>
          ) : null}
          <span className="flex-1" />
          <ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.name.trim()} />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <TextInput
            autoFocus
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Chicken breast"
          />
        </Field>
        {draft.barcode ? (
          <p className="text-xs text-ink-muted">
            📷 Scanned {draft.barcode} — rescanning this code will restock this item instead of adding a duplicate.
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity">
            <TextInput
              type="number"
              min={0}
              value={draft.quantity}
              onChange={(e) => set('quantity', numOr(e.target.value, 0))}
            />
          </Field>
          <Field label="Unit">
            <TextInput value={draft.unit} onChange={(e) => set('unit', e.target.value)} placeholder="lbs" />
          </Field>
          <Field label="Category">
            <Select value={draft.category} onChange={(e) => set('category', e.target.value as PantryCategory)}>
              {(Object.keys(CATEGORY_LABEL) as PantryCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Low-stock alert at"
          hint="Flagged as running low once quantity drops to this or below. Leave blank to never flag it."
        >
          <TextInput
            type="number"
            min={0}
            value={draft.lowStockThreshold ?? ''}
            onChange={(e) => set('lowStockThreshold', e.target.value === '' ? undefined : numOr(e.target.value, 0))}
          />
        </Field>

        <Field label="Notes">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
        </Field>
      </div>
    </Modal>
  );
}

export function ShoppingItemForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { add } = useStore();
  const { draft, set } = useFormDraft<ShoppingListItem>(open, () => ({
    id: '',
    name: '',
    checked: false,
    addedAt: new Date().toISOString(),
  }));

  const save = () => {
    if (!draft.name.trim()) return;
    add('shoppingListItems', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to shopping list"
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.name.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Item">
          <TextInput
            autoFocus
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Eggs"
          />
        </Field>
        <Field label="Quantity (optional)">
          <TextInput value={draft.quantity ?? ''} onChange={(e) => set('quantity', e.target.value || undefined)} placeholder="1 dozen" />
        </Field>
      </div>
    </Modal>
  );
}
