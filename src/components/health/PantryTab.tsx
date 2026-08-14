import { useState } from 'react';
import { PantryItemForm, ShoppingItemForm } from '@/components/forms/pantryForms';
import { MealPrepForm } from '@/components/forms/mealPrepForms';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  PencilIcon,
  TrashIcon,
} from '@/components/ui/primitives';
import { today } from '@/lib/date';
import { runningLow } from '@/lib/pantry';
import { useStore } from '@/store/store';
import type { MealPrepBatch, PantryCategory, PantryItem } from '@/types';

const CATEGORY_LABEL: Record<PantryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  grain: 'Grain',
  dairy: 'Dairy',
  frozen: 'Frozen',
  pantry: 'Pantry',
  other: 'Other',
};

/**
 * "What food do I have" in one place: raw pantry stock, meal-prepped
 * batches, and a shopping list that suggests itself from whatever pantry
 * stock has actually run low — never adds to the list on its own, only
 * ever offers, same as every other "suggest, don't guess" surface here.
 */
export function PantryTab() {
  return (
    <>
      <PantryCard />
      <MealPrepCard />
      <ShoppingListCard />
    </>
  );
}

function PantryCard() {
  const { state, update, add, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: PantryItem }>({ open: false });
  const items = [...state.pantryItems].sort((a, b) => a.name.localeCompare(b.name));
  const low = runningLow(state.pantryItems);

  const alreadyOnList = (pantryItemId: string) =>
    state.shoppingListItems.some((s) => s.pantryItemId === pantryItemId && !s.checked);

  const addToList = (item: PantryItem) => {
    add('shoppingListItems', {
      name: item.name,
      pantryItemId: item.id,
      checked: false,
      addedAt: new Date().toISOString(),
    });
  };

  const bump = (item: PantryItem, delta: number) => {
    update('pantryItems', item.id, {
      quantity: Math.max(0, item.quantity + delta),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <Card>
      <CardHeader
        title="Pantry"
        icon="🧺"
        subtitle="What's actually in the house"
        action={
          <button type="button" className="btn-primary !py-1 text-xs" onClick={() => setModal({ open: true })}>
            + Item
          </button>
        }
      />

      {low.length ? (
        <div className="border-b border-line bg-warning/5 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-warning">⚠ Running low</p>
          <ul className="space-y-1.5">
            {low.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-secondary">
                  {item.name} · {item.quantity} {item.unit} left
                </span>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-0.5 text-[11px]"
                  disabled={alreadyOnList(item.id)}
                  onClick={() => addToList(item)}
                >
                  {alreadyOnList(item.id) ? 'On list' : 'Add to list'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const isLow = item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
            return (
              <li key={item.id} className="group flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm text-ink">{item.name}</p>
                    {isLow ? <Badge tone="warning">Low</Badge> : null}
                  </div>
                  <p className="text-[11px] text-ink-muted">{CATEGORY_LABEL[item.category]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconButton onClick={() => bump(item, -1)} label={`Decrease ${item.name}`}>
                    <span aria-hidden="true">−</span>
                  </IconButton>
                  <span className="hud-mono w-16 text-center text-xs text-ink-secondary">
                    {item.quantity} {item.unit}
                  </span>
                  <IconButton onClick={() => bump(item, 1)} label={`Increase ${item.name}`}>
                    <span aria-hidden="true">+</span>
                  </IconButton>
                </div>
                <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton onClick={() => setModal({ open: true, item })} label="Edit item">
                    <PencilIcon />
                  </IconButton>
                  <IconButton onClick={() => remove('pantryItems', item.id)} label="Delete" tone="danger">
                    <TrashIcon />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState message="Nothing tracked yet — add what's in the kitchen." />
      )}
      <PantryItemForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
    </Card>
  );
}

function ShoppingListCard() {
  const { state, update, remove } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const items = [...state.shoppingListItems].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return b.addedAt.localeCompare(a.addedAt);
  });
  const hasChecked = items.some((i) => i.checked);

  const clearChecked = () => {
    state.shoppingListItems.filter((i) => i.checked).forEach((i) => remove('shoppingListItems', i.id));
  };

  return (
    <Card>
      <CardHeader
        title="Shopping list"
        icon="🛒"
        action={
          <div className="flex items-center gap-2">
            {hasChecked ? (
              <button type="button" className="btn-ghost !py-1 text-xs" onClick={clearChecked}>
                Clear checked
              </button>
            ) : null}
            <button type="button" className="btn-primary !py-1 text-xs" onClick={() => setFormOpen(true)}>
              + Item
            </button>
          </div>
        }
      />
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => update('shoppingListItems', item.id, { checked: e.target.checked })}
                className="h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--series-1))]"
                aria-label={`Mark ${item.name} bought`}
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${item.checked ? 'text-ink-muted line-through' : 'text-ink'}`}>
                  {item.name}
                </p>
                {item.quantity ? <p className="text-[11px] text-ink-muted">{item.quantity}</p> : null}
              </div>
              <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton onClick={() => remove('shoppingListItems', item.id)} label="Remove" tone="danger">
                  <TrashIcon />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="Nothing on the list — running-low pantry items will offer to add themselves here." />
      )}
      <ShoppingItemForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Card>
  );
}

function MealPrepCard() {
  const { state, logMealPrep } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: MealPrepBatch }>({ open: false });
  const batches = [...state.mealPrepBatches].sort((a, b) => (a.madeOn < b.madeOn ? 1 : -1));

  const logServing = (b: MealPrepBatch) => {
    logMealPrep(b.id, {
      date: today(),
      type: mealTypeNow(),
      name: b.name,
      time: new Date().toTimeString().slice(0, 5),
      clean: true,
      calories: b.caloriesPerServing,
      protein: b.proteinPerServing,
      carbs: b.carbsPerServing,
      fat: b.fatPerServing,
    });
  };

  return (
    <Card>
      <CardHeader
        title="Meal prep"
        icon="🍱"
        subtitle="Cooked once, logged in one tap all week"
        action={
          <button type="button" className="btn-primary !py-1 text-xs" onClick={() => setModal({ open: true })}>
            + Batch
          </button>
        }
      />
      {batches.length ? (
        <ul className="divide-y divide-line">
          {batches.map((b) => (
            <li key={b.id} className="group flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{b.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {b.caloriesPerServing} kcal{b.proteinPerServing ? ` · ${b.proteinPerServing}g protein` : ''} ·{' '}
                  {b.servingsLeft} of {b.totalServings} left
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1 text-xs"
                disabled={b.servingsLeft <= 0}
                onClick={() => logServing(b)}
              >
                {b.servingsLeft > 0 ? 'Log a serving' : 'Empty'}
              </button>
              <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton onClick={() => setModal({ open: true, item: b })} label="Edit batch">
                  <PencilIcon />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No batches yet — log one after your next cook day." />
      )}
      <MealPrepForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
    </Card>
  );
}

function mealTypeNow(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}
