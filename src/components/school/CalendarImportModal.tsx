import { useRef, useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/primitives';
import { dedupeMeetings, icsImporter } from '@/integrations/calendar';
import { useStore } from '@/store/store';
import type { Meeting } from '@/types';

/**
 * Same preview-then-confirm shape as the Apple Health import — nothing is
 * written until you say so, and events already on the calendar (matched by
 * title + date + start time) are dropped rather than duplicated.
 */
export function CalendarImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, replaceAll } = useStore();
  const [busy, setBusy] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMeetings(null);
    setWarnings([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setMeetings(null);
    setWarnings([]);
    try {
      const result = await icsImporter.parse(file);
      const fresh = dedupeMeetings(state.meetings, result.meetings);
      setMeetings(fresh);
      const dupes = result.meetings.length - fresh.length;
      const w = [...result.warnings];
      if (dupes) w.push(`${dupes} event(s) already on your calendar were skipped.`);
      setWarnings(w);
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : 'Could not read that file.']);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!meetings || !meetings.length) return;
    replaceAll({ ...state, meetings: [...state.meetings, ...meetings] });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import a calendar"
      footer={
        meetings && meetings.length ? (
          <ModalActions onCancel={close} onConfirm={confirm} confirmLabel={`Import ${meetings.length} event(s)`} />
        ) : (
          <button type="button" className="btn-ghost" onClick={close}>
            Close
          </button>
        )
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          Export a `.ics` file from Google Calendar, Apple Calendar, or Outlook and drop it here.
          Each event becomes a meeting; a weekly-repeating event stays weekly, everything else comes
          in as a one-time entry on its original date.
        </p>
        <button type="button" className="btn-primary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? 'Reading…' : 'Choose .ics file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = '';
          }}
        />

        {meetings ? (
          <div className="rounded-lg border border-line p-3">
            {meetings.length ? (
              <p className="text-sm font-medium text-ink">Found {meetings.length} event(s) to add.</p>
            ) : (
              <Badge tone="warning">Nothing new to import</Badge>
            )}
            {warnings.length ? (
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                {warnings.map((w, i) => (
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
