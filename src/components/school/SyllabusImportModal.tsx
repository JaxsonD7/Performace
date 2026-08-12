import { useRef, useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, IconButton, TextInput, TrashIcon } from '@/components/ui/primitives';
import { analyzeSyllabusPhoto, compressPhoto, VisionError, type SyllabusCategory } from '@/integrations/vision/claude';
import { useStore } from '@/store/store';

/**
 * Snap a photo of the grading-breakdown page of a syllabus, Claude reads the
 * category weights off it, you check the numbers before anything is saved —
 * same shape as the meal-photo flow, aimed at a different page of writing.
 * Nothing here ever runs on its own; a syllabus only becomes a course and
 * grade categories once you confirm.
 */
export function SyllabusImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, add } = useStore();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [instructor, setInstructor] = useState('');
  const [categories, setCategories] = useState<SyllabusCategory[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasKey = !!state.settings.anthropicApiKey;

  const reset = () => {
    setPhoto(null);
    setError(null);
    setNote(null);
    setCourseName('');
    setCourseCode('');
    setInstructor('');
    setCategories([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setError(null);
    try {
      const compressed = await compressPhoto(file, 1600, 0.85);
      setPhoto(compressed);
    } catch {
      setError('Could not read that photo.');
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await analyzeSyllabusPhoto(photo, state.settings.anthropicApiKey ?? '');
      setCourseName(result.courseName);
      setCourseCode(result.courseCode ?? '');
      setInstructor(result.instructor ?? '');
      setCategories(result.categories);
      if (result.note) setNote(result.note);
    } catch (err) {
      setError(err instanceof VisionError ? err.message : 'Something went wrong reading that photo.');
    } finally {
      setBusy(false);
    }
  };

  const totalWeight = categories.reduce((s, c) => s + c.weightPct, 0);

  const save = () => {
    if (!courseName.trim()) return;
    const courseId = add('courses', {
      name: courseName.trim(),
      code: courseCode.trim() || undefined,
      instructor: instructor.trim() || undefined,
      colorSlot: (state.courses.length % 8) + 1,
    });
    categories.forEach((c) => {
      add('gradeCategories', { courseId, name: c.name, weightPct: c.weightPct });
    });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Scan a syllabus"
      footer={
        courseName.trim() ? (
          <ModalActions onCancel={close} onConfirm={save} confirmLabel="Add course" disabled={!courseName.trim()} />
        ) : (
          <button type="button" className="btn-ghost" onClick={close}>
            Close
          </button>
        )
      }
    >
      <div className="space-y-4">
        {!hasKey ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink-secondary">
            This needs your Anthropic API key — add one under Settings → Meal photo analysis (the same
            key covers both) before scanning.
          </p>
        ) : null}

        <div>
          <span className="label">Photo of the grading breakdown</span>
          {photo ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              <img src={photo} alt="" className="max-h-64 w-full object-contain bg-raised" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/50 p-2 backdrop-blur-sm">
                <button
                  type="button"
                  className="btn-quiet !py-1 text-xs text-white hover:bg-white/10"
                  onClick={() => setPhoto(null)}
                >
                  Remove
                </button>
                {hasKey ? (
                  <button type="button" className="btn-primary !py-1 text-xs" onClick={() => void analyze()} disabled={busy}>
                    {busy ? 'Reading…' : 'Read with Claude'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-6 text-sm text-ink-muted hover:border-brand/40 hover:text-ink-secondary"
              onClick={() => fileInput.current?.click()}
            >
              📄 Add a photo of the syllabus
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
        </div>

        {error ? <p className="text-xs text-critical">{error}</p> : null}
        {note ? <p className="text-xs text-warning">⚠ {note}</p> : null}

        {courseName || categories.length ? (
          <div className="space-y-4 rounded-lg border border-line p-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Course name" className="col-span-3 sm:col-span-1">
                <TextInput value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              </Field>
              <Field label="Code">
                <TextInput value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
              </Field>
              <Field label="Instructor">
                <TextInput value={instructor} onChange={(e) => setInstructor(e.target.value)} />
              </Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="label mb-0">Grading categories</span>
                <span className={`hud-mono text-[11px] ${totalWeight === 100 ? 'text-good' : 'text-warning'}`}>
                  {totalWeight}% total
                </span>
              </div>
              <div className="space-y-2">
                {categories.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TextInput
                      value={c.name}
                      onChange={(e) =>
                        setCategories((cs) => cs.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                      }
                      className="flex-1"
                    />
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      value={c.weightPct}
                      onChange={(e) =>
                        setCategories((cs) =>
                          cs.map((x, xi) => (xi === i ? { ...x, weightPct: Number(e.target.value) || 0 } : x)),
                        )
                      }
                      className="w-20 text-center"
                    />
                    <span className="text-xs text-ink-muted">%</span>
                    <IconButton
                      onClick={() => setCategories((cs) => cs.filter((_, xi) => xi !== i))}
                      label="Remove category"
                      tone="danger"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-quiet !px-2 !py-1 text-xs"
                  onClick={() => setCategories((cs) => [...cs, { name: '', weightPct: 0 }])}
                >
                  + Category
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
