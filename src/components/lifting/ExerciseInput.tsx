import { useId, useMemo } from 'react';
import { TextInput } from '@/components/ui/primitives';
import { combinedExerciseLibrary } from '@/data/exerciseLibrary';
import { useStore } from '@/store/store';

/**
 * A plain text input backed by a native `<datalist>` of the exercise library
 * plus every exercise you have ever typed. No dependency, keyboard-navigable
 * for free, and typing something new just works — it becomes a custom
 * exercise the next time `ExerciseInput` is used (see `useExerciseCatalog`).
 */
export function ExerciseInput({
  value,
  onChange,
  placeholder = 'Exercise name',
  autoFocus,
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { state } = useStore();
  const listId = useId();
  const library = useMemo(
    () => combinedExerciseLibrary(state.customExercises),
    [state.customExercises],
  );

  return (
    <>
      <TextInput
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <datalist id={listId}>
        {library.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
    </>
  );
}

/** Saves a typed exercise name into the custom library if it's genuinely new. */
export function useRememberExercise() {
  const { state, add } = useStore();
  return (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const library = combinedExerciseLibrary(state.customExercises);
    const exists = library.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      add('customExercises', { name: trimmed, muscles: [], custom: true });
    }
  };
}
