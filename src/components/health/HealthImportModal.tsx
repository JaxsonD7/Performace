import { useEffect, useRef, useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Badge, Field, Segmented, TextArea } from '@/components/ui/primitives';
import { parseAppleHealthExport } from '@/integrations/health/appleHealthXml';
import { parseShortcutPayload, SHORTCUT_EXAMPLE } from '@/integrations/health/shortcut';
import { mergeHealth } from '@/integrations/health';
import type { HealthImport } from '@/integrations/health/types';
import { addDays, today } from '@/lib/date';
import { useStore } from '@/store/store';

type Mode = 'file' | 'paste';

/**
 * One modal, two ways in: an Apple Health `export.xml` for bulk history, or a
 * pasted JSON blob from an iOS Shortcut for a quick daily update. Both funnel
 * through the same preview-then-confirm step so nothing is written until you
 * say so.
 */
export function HealthImportModal({
  open,
  onClose,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-parsed immediately on open — the Shortcut's "Open URL" step lands here. */
  initialData?: string;
}) {
  const { state, replaceAll } = useStore();
  const [mode, setMode] = useState<Mode>('paste');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ fraction: number; note?: string } | null>(null);
  const [result, setResult] = useState<HealthImport | null>(null);
  const [pasted, setPasted] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // A Shortcut landing via "Open URL" arrives as `initialData` — parse it the
  // moment the modal opens so there is a preview waiting with nothing to type.
  useEffect(() => {
    if (open && initialData) {
      setPasted(initialData);
      setResult(parseShortcutPayload(initialData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const reset = () => {
    setResult(null);
    setProgress(null);
    setPasted('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const since = addDays(today(), -365);
      const parsed = await parseAppleHealthExport(file, {
        since,
        onProgress: (fraction, note) => setProgress({ fraction, note }),
      });
      setResult(parsed);
    } catch (err) {
      setResult({
        metrics: [],
        sleep: [],
        workouts: [],
        dates: [],
        warnings: [err instanceof Error ? err.message : 'Could not read that file.'],
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const onPaste = () => {
    if (!pasted.trim()) return;
    setResult(parseShortcutPayload(pasted));
  };

  const confirm = () => {
    if (!result) return;
    const health = mergeHealth(state.health, result.metrics);
    // Sleep and workouts replace same-day entries from the same import source
    // rather than piling up duplicates on a re-import.
    const sleepDates = new Set(result.sleep.map((s) => s.date));
    const sleep = [...state.sleep.filter((s) => !sleepDates.has(s.date)), ...result.sleep];
    const workoutDates = new Set(result.workouts.map((w) => w.date));
    const workouts = [...state.workouts.filter((w) => !workoutDates.has(w.date)), ...result.workouts];

    replaceAll({ ...state, health, sleep, workouts });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import health data"
      footer={
        result && result.dates.length ? (
          <ModalActions onCancel={close} onConfirm={confirm} confirmLabel={`Import ${result.dates.length} day(s)`} />
        ) : (
          <button type="button" className="btn-ghost" onClick={close}>
            Close
          </button>
        )
      }
    >
      <div className="space-y-4">
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
          options={[
            { value: 'paste', label: 'Shortcut (daily)' },
            { value: 'file', label: 'Apple Health export (history)' },
          ]}
        />

        {mode === 'paste' ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-secondary">
              Build an iOS Shortcut that reads today's Health data and opens this app with the
              numbers as a JSON blob — paste what it produces here, or paste it directly for a
              one-off entry.
            </p>
            <Field label="Data">
              <TextArea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={JSON.stringify(SHORTCUT_EXAMPLE, null, 2)}
                className="min-h-[140px] font-mono text-xs"
              />
            </Field>
            <button type="button" className="btn-primary" onClick={onPaste} disabled={!pasted.trim()}>
              Read this
            </button>
            <details className="rounded-lg bg-raised p-3 text-xs text-ink-secondary">
              <summary className="cursor-pointer font-medium text-ink">
                How to build the Shortcut
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Shortcuts app → New Shortcut</li>
                <li>
                  Add "Find Health Samples" actions for Steps, Active Energy, Exercise Time, Resting
                  Heart Rate, HRV, and Sleep — set each to "Today" (or "Yesterday" for sleep)
                </li>
                <li>Add a "Text" action that assembles a JSON object from those values, matching the field names above</li>
                <li>
                  Add "Open URL" with{' '}
                  <code className="rounded bg-surface px-1">
                    https://jaxsond7.github.io/Performace/#/health?data=YOUR_JSON
                  </code>
                </li>
                <li>Automation tab → add a daily time trigger that runs it, or run it by hand each evening</li>
              </ol>
            </details>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-secondary">
              iPhone → Health app → your profile picture → <strong>Export All Health Data</strong> →
              unzip → pick <code className="rounded bg-raised px-1">export.xml</code> below. Large
              files (hundreds of MB) are normal and are read in the browser — nothing uploads
              anywhere.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              {busy ? 'Reading…' : 'Choose export.xml'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = '';
              }}
            />
            {progress ? (
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                {progress.note ? <p className="mt-1 text-xs text-ink-muted">{progress.note}</p> : null}
              </div>
            ) : null}
            <p className="text-xs text-ink-muted">Only the last 365 days are imported.</p>
          </div>
        )}

        {result ? (
          <div className="rounded-lg border border-line p-3">
            {result.dates.length ? (
              <>
                <p className="text-sm font-medium text-ink">
                  Found {result.dates.length} day(s) · {result.metrics.length} metric entries ·{' '}
                  {result.sleep.length} nights · {result.workouts.length} workouts
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {result.dates[0]} → {result.dates[result.dates.length - 1]}
                </p>
              </>
            ) : (
              <Badge tone="warning">Nothing usable found</Badge>
            )}
            {result.warnings.length ? (
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                {result.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
