import { useEffect, useState } from 'react';

/**
 * Holds an editable copy of a record while a modal is open.
 *
 * The draft is rebuilt every time the modal opens so reopening an "add" form
 * never shows the previous entry, and opening an "edit" form always starts from
 * the record as it is right now. Nothing is written to the store until save.
 */
export function useFormDraft<T extends object>(open: boolean, factory: () => T) {
  const [draft, setDraft] = useState<T>(factory);

  useEffect(() => {
    if (open) setDraft(factory());
    // `factory` is intentionally excluded: callers pass an inline closure, and
    // re-running on its identity would reset the form on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof T>(key: K, value: T[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return { draft, set, setDraft };
}

/** Parses a number input, treating an empty field as "not recorded". */
export function num(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Same, but for required numbers with a fallback. */
export function numOr(value: string, fallback: number): number {
  return num(value) ?? fallback;
}
