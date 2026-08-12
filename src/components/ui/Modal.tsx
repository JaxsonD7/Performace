import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A single dialog shell for every add/edit form in the app. It traps nothing
 * fancy — one focus ring, Escape to close, scroll lock — but it keeps every
 * form looking and behaving the same way.
 *
 * Rendered through a portal to `document.body` on purpose: this component is
 * routinely mounted as a JSX child of a `Card`, and `Card` carries a `filter`
 * (for the glow that survives its clipped corners) — `filter` on an ancestor
 * makes it the containing block for `position: fixed` descendants per the CSS
 * spec, which would otherwise trap this dialog inside that card's own small
 * box instead of covering the viewport. Portaling out is the fix that holds
 * regardless of what an ancestor's CSS does next.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border',
          'border-line bg-surface shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        ].join(' ')}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-raised/60 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Standard footer: cancel on the left of a primary confirm. */
export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  destructive,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <button type="button" className="btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className={destructive ? 'btn bg-critical text-white hover:opacity-90' : 'btn-primary'}
        onClick={onConfirm}
        disabled={disabled}
      >
        {confirmLabel}
      </button>
    </>
  );
}
