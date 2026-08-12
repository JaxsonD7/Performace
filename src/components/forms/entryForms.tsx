import { Modal, ModalActions } from '@/components/ui/Modal';
import { Field, Select, TextArea, TextInput } from '@/components/ui/primitives';
import { num, numOr, useFormDraft } from '@/components/forms/useFormDraft';
import { today } from '@/lib/date';
import { WEEKDAYS, WEEKDAY_NAMES } from '@/lib/routine';
import { useStore } from '@/store/store';
import type {
  Assignment,
  Course,
  CourseMeeting,
  Goal,
  Habit,
  ISODate,
  LifeArea,
  Meeting,
  Task,
} from '@/types';

const AREAS: LifeArea[] = ['faith', 'fitness', 'school', 'reading', 'health', 'personal', 'social'];

interface FormProps<T> {
  open: boolean;
  onClose: () => void;
  /** Omit to create a new record. */
  initial?: T;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export function TaskForm({
  open,
  onClose,
  initial,
  date = today(),
}: FormProps<Task> & { date?: ISODate }) {
  const { add, update } = useStore();
  const { draft, set } = useFormDraft<Task>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          title: '',
          area: 'personal',
          priority: 'medium',
          date,
          estimateMin: 30,
          completed: false,
          schedule: true,
          createdAt: new Date().toISOString(),
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('tasks', initial.id, draft);
    else add('tasks', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit task' : 'New task'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Task">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="What needs doing?"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <Select value={draft.area} onChange={(e) => set('area', e.target.value as LifeArea)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a[0].toUpperCase() + a.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) => set('priority', e.target.value as Task['priority'])}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Date" hint="Leave blank to keep it in the backlog">
            <TextInput
              type="date"
              value={draft.date ?? ''}
              onChange={(e) => set('date', e.target.value || undefined)}
            />
          </Field>
          <Field label="Estimate (min)">
            <TextInput
              type="number"
              min={5}
              step={5}
              value={draft.estimateMin}
              onChange={(e) => set('estimateMin', numOr(e.target.value, 30))}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={draft.schedule}
            onChange={(e) => set('schedule', e.target.checked)}
            className="h-4 w-4 rounded border-line accent-[rgb(var(--series-1))]"
          />
          Let the planner find time for this
        </label>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Habit (also used for Orthodox practices)
// ---------------------------------------------------------------------------

export function HabitForm({
  open,
  onClose,
  initial,
  group = 'improvement',
}: FormProps<Habit> & { group?: Habit['group'] }) {
  const { add, update, removeHabit, state } = useStore();
  const { draft, set } = useFormDraft<Habit>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          name: '',
          group,
          icon: group === 'orthodox' ? '📿' : '✅',
          targetPerWeek: 7,
          archived: false,
          sortOrder: state.habits.length + 1,
          createdAt: new Date().toISOString(),
        },
  );

  const save = () => {
    if (!draft.name.trim()) return;
    if (initial) update('habits', initial.id, draft);
    else add('habits', draft);
    onClose();
  };

  const label = draft.group === 'orthodox' ? 'practice' : 'habit';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit ${label}` : `New ${label}`}
      footer={
        <>
          {initial ? (
            <button
              type="button"
              className="btn text-critical hover:bg-critical/10"
              onClick={() => {
                removeHabit(initial.id);
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
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <Field label="Icon">
            <TextInput
              value={draft.icon}
              onChange={(e) => set('icon', e.target.value)}
              className="input text-center text-lg"
              maxLength={2}
            />
          </Field>
          <Field label="Name">
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={draft.group === 'orthodox' ? 'Prayer rule' : 'Make the bed'}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Section">
            <Select
              value={draft.group}
              onChange={(e) => set('group', e.target.value as Habit['group'])}
            >
              <option value="improvement">Daily checklist</option>
              <option value="orthodox">Orthodox rule</option>
              <option value="general">Tracked only</option>
            </Select>
          </Field>
          <Field label="Days per week" hint="7 = every day">
            <TextInput
              type="number"
              min={1}
              max={7}
              value={draft.targetPerWeek}
              onChange={(e) => set('targetPerWeek', Math.min(7, Math.max(1, numOr(e.target.value, 7))))}
            />
          </Field>
          <Field label="Anchor time" hint="Optional — puts it on the schedule">
            <TextInput
              type="time"
              value={draft.anchorTime ?? ''}
              onChange={(e) => set('anchorTime', e.target.value || undefined)}
            />
          </Field>
          <Field label="Minutes to reserve">
            <TextInput
              type="number"
              min={5}
              step={5}
              value={draft.durationMin ?? ''}
              onChange={(e) => set('durationMin', num(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export function GoalForm({ open, onClose, initial }: FormProps<Goal>) {
  const { add, update, state } = useStore();
  const { draft, set } = useFormDraft<Goal>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          title: '',
          area: 'faith',
          unit: 'days',
          target: 7,
          current: 0,
          period: 'week',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('goals', initial.id, draft);
    else add('goals', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit goal' : 'New goal'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Goal">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Keep the full prayer rule every day"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <Select value={draft.area} onChange={(e) => set('area', e.target.value as LifeArea)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a[0].toUpperCase() + a.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period">
            <Select
              value={draft.period}
              onChange={(e) => set('period', e.target.value as Goal['period'])}
            >
              <option value="day">Per day</option>
              <option value="week">Per week</option>
              <option value="month">Per month</option>
              <option value="year">Per year</option>
            </Select>
          </Field>
          <Field label="Target">
            <TextInput
              type="number"
              min={1}
              value={draft.target}
              onChange={(e) => set('target', numOr(e.target.value, 1))}
            />
          </Field>
          <Field label="Unit">
            <TextInput
              value={draft.unit}
              onChange={(e) => set('unit', e.target.value)}
              placeholder="days, pages, workouts"
            />
          </Field>
        </div>

        <Field
          label="Count from a habit"
          hint="Progress then follows that habit's completions this period"
        >
          <Select
            value={draft.linkedHabitId ?? ''}
            onChange={(e) => set('linkedHabitId', e.target.value || undefined)}
          >
            <option value="">Track manually</option>
            {state.habits
              .filter((h) => !h.archived)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.icon} {h.name}
                </option>
              ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target date">
            <TextInput
              type="date"
              value={draft.dueDate ?? ''}
              onChange={(e) => set('dueDate', e.target.value || undefined)}
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Goal['status'])}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
            </Select>
          </Field>
        </div>

        <Field label="Why this matters">
          <TextArea
            value={draft.description ?? ''}
            onChange={(e) => set('description', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// School assignment
// ---------------------------------------------------------------------------

export function AssignmentForm({ open, onClose, initial }: FormProps<Assignment>) {
  const { add, update, state } = useStore();
  const { draft, set } = useFormDraft<Assignment>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          title: '',
          type: 'homework',
          dueDate: today(),
          estimateMin: 60,
          status: 'not-started',
          priority: 'medium',
          loggedMin: 0,
          createdAt: new Date().toISOString(),
          schedule: false,
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('assignments', initial.id, draft);
    else add('assignments', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit assignment' : 'New assignment'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Assignment">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Problem set 7"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Course">
            <Select
              value={draft.courseId ?? ''}
              onChange={(e) => set('courseId', e.target.value || undefined)}
            >
              <option value="">No course</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select
              value={draft.type}
              onChange={(e) => set('type', e.target.value as Assignment['type'])}
            >
              {['homework', 'reading', 'project', 'exam', 'quiz', 'essay', 'other'].map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due">
            <TextInput
              type="date"
              value={draft.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </Field>
          <Field label="Estimate (min)">
            <TextInput
              type="number"
              min={10}
              step={10}
              value={draft.estimateMin}
              onChange={(e) => set('estimateMin', numOr(e.target.value, 60))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) => set('priority', e.target.value as Assignment['priority'])}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Assignment['status'])}
            >
              <option value="not-started">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="done">Done</option>
            </Select>
          </Field>
          <Field label="Minutes logged">
            <TextInput
              type="number"
              min={0}
              step={5}
              value={draft.loggedMin}
              onChange={(e) => set('loggedMin', numOr(e.target.value, 0))}
            />
          </Field>
          <Field label="Grade">
            <TextInput
              value={draft.grade ?? ''}
              onChange={(e) => set('grade', e.target.value || undefined)}
              placeholder="A-"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={draft.schedule}
            onChange={(e) => set('schedule', e.target.checked)}
            className="h-4 w-4 rounded border-line accent-[rgb(var(--series-1))]"
          />
          Let the planner find time for this
        </label>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Meeting / club event
// ---------------------------------------------------------------------------

export function MeetingForm({
  open,
  onClose,
  initial,
  date = today(),
}: FormProps<Meeting> & { date?: ISODate }) {
  const { add, update } = useStore();
  const { draft, set } = useFormDraft<Meeting>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          title: '',
          kind: 'club',
          date,
          startTime: '17:00',
          endTime: '18:00',
          repeat: 'none',
        },
  );

  const save = () => {
    if (!draft.title.trim()) return;
    if (initial) update('meetings', initial.id, draft);
    else add('meetings', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit event' : 'New meeting or event'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.title.trim()} />}
    >
      <div className="space-y-4">
        <Field label="Title">
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Orthodox Christian Fellowship"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => set('kind', e.target.value as Meeting['kind'])}
            >
              {['club', 'class', 'meeting', 'church', 'social', 'other'].map((k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Repeat">
            <Select
              value={draft.repeat}
              onChange={(e) => set('repeat', e.target.value as Meeting['repeat'])}
            >
              <option value="none">One time</option>
              <option value="weekly">Every week</option>
            </Select>
          </Field>
          <Field label="Date">
            <TextInput
              type="date"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label="Location">
            <TextInput
              value={draft.location ?? ''}
              onChange={(e) => set('location', e.target.value || undefined)}
              placeholder="Student Center"
            />
          </Field>
          <Field label="Starts">
            <TextInput
              type="time"
              value={draft.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <TextInput
              type="time"
              value={draft.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

export function CourseForm({ open, onClose, initial }: FormProps<Course>) {
  const { add, update, state } = useStore();
  const { draft, set } = useFormDraft<Course>(open, () =>
    initial
      ? { ...initial }
      : { id: '', name: '', colorSlot: ((state.courses.length % 8) + 1) as number },
  );

  const save = () => {
    if (!draft.name.trim()) return;
    if (initial) update('courses', initial.id, draft);
    else add('courses', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit course' : 'New course'}
      footer={<ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.name.trim()} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <TextInput
            autoFocus
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Calculus II"
          />
        </Field>
        <Field label="Code">
          <TextInput
            value={draft.code ?? ''}
            onChange={(e) => set('code', e.target.value || undefined)}
            placeholder="MATH 152"
          />
        </Field>
        <Field label="Instructor">
          <TextInput
            value={draft.instructor ?? ''}
            onChange={(e) => set('instructor', e.target.value || undefined)}
            placeholder="Dr. Papadopoulos"
          />
        </Field>
        <Field label="Color">
          <Select
            value={String(draft.colorSlot)}
            onChange={(e) => set('colorSlot', Number(e.target.value))}
          >
            {['Blue', 'Orange', 'Aqua', 'Yellow', 'Magenta', 'Green', 'Violet', 'Red'].map(
              (name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ),
            )}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Class meeting time — the ONLY thing that puts a "Classes" block on the
// schedule. Nothing about school hours is ever guessed; this is you telling
// the app exactly when and where a course meets, once, and it recurs weekly.
// ---------------------------------------------------------------------------

export function CourseMeetingForm({
  open,
  onClose,
  initial,
  defaultCourseId,
}: FormProps<CourseMeeting> & { defaultCourseId?: string }) {
  const { add, update, remove, state } = useStore();
  const { draft, set } = useFormDraft<CourseMeeting>(open, () =>
    initial
      ? { ...initial }
      : {
          id: '',
          courseId: defaultCourseId ?? state.courses[0]?.id ?? '',
          weekday: 1,
          startTime: '09:00',
          endTime: '09:50',
        },
  );

  const save = () => {
    if (!draft.courseId) return;
    if (initial) update('courseMeetings', initial.id, draft);
    else add('courseMeetings', draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit class time' : 'Add a class time'}
      footer={
        <>
          {initial ? (
            <button
              type="button"
              className="btn text-critical hover:bg-critical/10"
              onClick={() => {
                remove('courseMeetings', initial.id);
                onClose();
              }}
            >
              Remove
            </button>
          ) : null}
          <span className="flex-1" />
          <ModalActions onCancel={onClose} onConfirm={save} disabled={!draft.courseId} />
        </>
      }
    >
      <div className="space-y-4">
        {state.courses.length ? (
          <Field label="Course">
            <Select value={draft.courseId} onChange={(e) => set('courseId', e.target.value)}>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="rounded-lg bg-raised px-3 py-2 text-sm text-ink-secondary">
            Add a course first — class times attach to a course.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Day">
            <Select
              value={String(draft.weekday)}
              onChange={(e) => set('weekday', Number(e.target.value) as CourseMeeting['weekday'])}
            >
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starts">
            <TextInput
              type="time"
              value={draft.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <TextInput
              type="time"
              value={draft.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Location">
          <TextInput
            value={draft.location ?? ''}
            onChange={(e) => set('location', e.target.value || undefined)}
            placeholder="Building, room number"
          />
        </Field>
      </div>
    </Modal>
  );
}
