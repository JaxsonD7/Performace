import { useAppUpdate } from '@/pwa/useAppUpdate';

/**
 * Sits above the mobile nav bar and out of the way on desktop. It only ever
 * appears when a newer build is already downloaded and waiting, so tapping
 * Update is instant and works offline.
 */
export function UpdateBanner() {
  const { updateReady, update } = useAppUpdate();

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto
                 flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface
                 px-4 py-3 shadow-lg lg:bottom-4 lg:left-auto lg:right-4 lg:mx-0"
    >
      <span className="text-lg leading-none" aria-hidden="true">
        ✨
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">A new version is ready</p>
        <p className="text-xs text-ink-muted">Your data is untouched by updates.</p>
      </div>
      <button type="button" className="btn-primary shrink-0 !py-1.5 text-xs" onClick={update}>
        Update
      </button>
    </div>
  );
}
