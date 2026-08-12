import { useState } from 'react';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { useAppUpdate } from '@/pwa/useAppUpdate';
import { useInstallPrompt } from '@/pwa/useInstallPrompt';

/**
 * The Settings entry for the app itself: install it, see what build is running,
 * and force an update check instead of waiting for the hourly one.
 */
export function AppCard() {
  const { state, install } = useInstallPrompt();
  const { updateReady, update, checkNow } = useAppUpdate();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);

  const runCheck = async () => {
    setChecking(true);
    setChecked(null);
    try {
      await checkNow();
      // The worker answers asynchronously; give it a moment before reporting,
      // otherwise "up to date" would appear before the check finished.
      await new Promise((r) => setTimeout(r, 1200));
      setChecked(updateReady ? 'An update is ready below.' : 'You are on the latest version.');
    } catch {
      setChecked('Could not reach the server. You are offline — the app still works.');
    } finally {
      setChecking(false);
    }
  };

  const built = new Date(__BUILD_TIME__);

  return (
    <Card>
      <CardHeader
        title="App & updates"
        icon="📲"
        action={
          state === 'installed' ? <Badge tone="good">✓ Installed</Badge> : null
        }
      />
      <div className="card-pad space-y-4">
        {state === 'available' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-raised px-3 py-2.5">
            <p className="text-sm text-ink-secondary">
              Install Performace to open it from your dock or home screen.
            </p>
            <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => void install()}>
              Install
            </button>
          </div>
        ) : null}

        {state === 'ios-manual' ? (
          <div className="rounded-lg bg-raised px-3 py-2.5 text-sm text-ink-secondary">
            <p className="mb-1 font-medium text-ink">Add to your home screen</p>
            <p>
              Tap the Share button in Safari, then <strong>Add to Home Screen</strong>. It opens
              full screen with no browser bar, and works with no signal.
            </p>
          </div>
        ) : null}

        {state === 'unsupported' ? (
          <div className="rounded-lg bg-raised px-3 py-2.5 text-sm text-ink-secondary">
            <p className="mb-1 font-medium text-ink">Install from your browser</p>
            <p>
              In Chrome or Edge, use the install icon at the right of the address bar (or menu →
              Install app). Your browser may only offer it after a couple of visits.
            </p>
          </div>
        ) : null}

        {state === 'installed' ? (
          <p className="text-sm text-ink-secondary">
            Running as an installed app. It works offline, and new versions arrive on their own.
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-line px-2.5 py-2">
            <dt className="text-ink-muted">Build</dt>
            <dd className="mt-0.5 font-mono text-[11px] text-ink">{__BUILD_COMMIT__}</dd>
          </div>
          <div className="rounded-lg border border-line px-2.5 py-2">
            <dt className="text-ink-muted">Updated</dt>
            <dd className="mt-0.5 text-[11px] text-ink">
              {built.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })},{' '}
              {built.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => void runCheck()} disabled={checking}>
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {updateReady ? (
            <button type="button" className="btn-primary" onClick={update}>
              Update now
            </button>
          ) : null}
        </div>

        {checked ? <p className="text-xs text-ink-muted">{checked}</p> : null}

        <p className="border-t border-line pt-3 text-xs text-ink-muted">
          Updates replace the app, never your data — everything you have tracked stays in this
          browser's storage. Export a backup before clearing site data or moving devices.
        </p>
      </div>
    </Card>
  );
}
