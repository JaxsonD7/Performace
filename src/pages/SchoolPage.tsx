import { useMemo, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import {
  AssignmentForm,
  CourseForm,
  CourseMeetingForm,
  GradeCategoryForm,
  GradeEntryForm,
  MeetingForm,
  TaskForm,
} from '@/components/forms/entryForms';
import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  IconButton,
  PencilIcon,
  Progress,
  Segmented,
  TrashIcon,
  cx,
} from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/charts';
import { CalendarImportModal } from '@/components/school/CalendarImportModal';
import { SyllabusImportModal } from '@/components/school/SyllabusImportModal';
import { downloadIcs } from '@/integrations/calendar/export';
import { formatDuration, formatTime, relativeDay, today } from '@/lib/date';
import { courseGrade, letterGrade, neededAverage } from '@/lib/grades';
import { WEEKDAY_SHORT } from '@/lib/routine';
import { openAssignments, upcomingMeetings } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { Assignment, Course, CourseMeeting, GradeCategory, GradeEntry, Meeting, Task } from '@/types';

type Tab = 'assignments' | 'tasks' | 'meetings' | 'courses' | 'grades';

export function SchoolPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('assignments');

  const open = useMemo(() => openAssignments(state), [state]);
  const workloadMin = open.reduce((s, a) => s + Math.max(0, a.estimateMin - a.loggedMin), 0);
  const openTasks = state.tasks.filter((t) => !t.completed);
  const overdue = openTasks.filter((t) => t.date && t.date < today());

  return (
    <>
      <PageHeader
        title="School & tasks"
        subtitle="Everything you owe, in the order it comes due."
      >
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'assignments', label: `Assignments (${open.length})` },
            { value: 'tasks', label: `Tasks (${openTasks.length})` },
            { value: 'meetings', label: 'Meetings' },
            { value: 'courses', label: 'Courses' },
            { value: 'grades', label: 'Grades' },
          ]}
        />
      </PageHeader>

      <PageBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Open assignments" value={open.length} />
          <StatTile label="Work remaining" value={formatDuration(workloadMin)} />
          <StatTile label="Open tasks" value={openTasks.length} />
          <StatTile
            label="Overdue"
            value={overdue.length}
            tone={overdue.length ? 'critical' : 'default'}
            hint={overdue.length ? 'Reschedule or drop these' : 'Nothing slipping'}
          />
        </div>

        {tab === 'assignments' ? <AssignmentsTab /> : null}
        {tab === 'tasks' ? <TasksTab /> : null}
        {tab === 'meetings' ? <MeetingsTab /> : null}
        {tab === 'courses' ? <CoursesTab /> : null}
        {tab === 'grades' ? <GradesTab /> : null}
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------------------

/** Tests/quizzes vs. homework-ish deliverables vs. bare class-day content. */
const TEST_QUIZ_TYPES: Assignment['type'][] = ['exam', 'quiz'];
const CLASS_TOPIC_TYPES: Assignment['type'][] = ['other'];

function AssignmentsTab() {
  const { state, update, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Assignment }>({ open: false });
  const [showDone, setShowDone] = useState(false);

  const all = useMemo(
    () =>
      showDone
        ? [...state.assignments].sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))
        : openAssignments(state),
    [state, showDone],
  );

  const testsQuizzes = all.filter((a) => TEST_QUIZ_TYPES.includes(a.type));
  const classTopics = all.filter((a) => CLASS_TOPIC_TYPES.includes(a.type));
  const homework = all.filter(
    (a) => !TEST_QUIZ_TYPES.includes(a.type) && !CLASS_TOPIC_TYPES.includes(a.type),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn-quiet !px-2 !py-1 text-xs"
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? 'Hide finished' : 'Show finished'}
        </button>
        <button
          type="button"
          className="btn-primary !py-1 text-xs"
          onClick={() => setModal({ open: true })}
        >
          + Assignment
        </button>
      </div>

      <AssignmentSection
        title="Tests & quizzes"
        icon="📝"
        rows={testsQuizzes}
        state={state}
        update={update}
        remove={remove}
        onEdit={(item) => setModal({ open: true, item })}
        emptyMessage="No exams or quizzes on the books."
      />
      <AssignmentSection
        title="Homework"
        icon="🎓"
        rows={homework}
        state={state}
        update={update}
        remove={remove}
        onEdit={(item) => setModal({ open: true, item })}
        emptyMessage="Nothing due. Add an assignment to start tracking it."
      />
      <AssignmentSection
        title="What's covered in class"
        icon="🏫"
        rows={classTopics}
        state={state}
        update={update}
        remove={remove}
        onEdit={(item) => setModal({ open: true, item })}
        emptyMessage="No class-day content logged."
      />

      <AssignmentForm
        open={modal.open}
        onClose={() => setModal({ open: false })}
        initial={modal.item}
      />
    </div>
  );
}

function AssignmentSection({
  title,
  icon,
  rows,
  state,
  update,
  remove,
  onEdit,
  emptyMessage,
}: {
  title: string;
  icon: string;
  rows: Assignment[];
  state: ReturnType<typeof useStore>['state'];
  update: ReturnType<typeof useStore>['update'];
  remove: ReturnType<typeof useStore>['remove'];
  onEdit: (item: Assignment) => void;
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} subtitle={rows.length ? `${rows.length}` : undefined} />
      {rows.length ? (
        <div className="scroll-x">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Assignment</th>
                <th className="px-3 py-2 font-medium">Course</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((a) => {
                const course = state.courses.find((c) => c.id === a.courseId);
                const overdue = a.status !== 'done' && a.dueDate < today();
                return (
                  <tr key={a.id} className="group">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={a.status === 'done'}
                        onChange={(e) =>
                          update('assignments', a.id, {
                            status: e.target.checked ? 'done' : 'in-progress',
                          })
                        }
                        className="h-4 w-4 rounded border-line accent-[rgb(var(--series-1))]"
                        aria-label={`Mark ${a.title} done`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cx(
                          'block',
                          a.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                        )}
                      >
                        {a.title}
                      </span>
                      <span className="text-[11px] capitalize text-ink-muted">{a.type}</span>
                    </td>
                    <td className="px-3 py-2">
                      {course ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: `rgb(var(--series-${course.colorSlot}))` }}
                            aria-hidden="true"
                          />
                          {course.name}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {overdue ? (
                        <Badge tone="critical">⚠ {relativeDay(a.dueDate)}</Badge>
                      ) : (
                        <span className="text-ink-secondary">{relativeDay(a.dueDate)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="w-28">
                        <Progress
                          value={a.loggedMin}
                          max={Math.max(a.estimateMin, 1)}
                          hint={`${a.loggedMin}/${a.estimateMin}m`}
                          label=""
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => onEdit(a)} label="Edit">
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => remove('assignments', a.id)}
                          label="Delete"
                          tone="danger"
                        >
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TasksTab() {
  const { state, update, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Task }>({ open: false });

  const groups: [string, Task[]][] = [
    ['Overdue', state.tasks.filter((t) => !t.completed && t.date && t.date < today())],
    ['Today', state.tasks.filter((t) => !t.completed && t.date === today())],
    [
      'Upcoming',
      state.tasks.filter((t) => !t.completed && t.date && t.date > today()),
    ],
    ['Backlog', state.tasks.filter((t) => !t.completed && !t.date)],
    ['Done', state.tasks.filter((t) => t.completed)],
  ];

  return (
    <Card>
      <CardHeader
        title="Tasks"
        icon="✓"
        action={
          <button
            type="button"
            className="btn-primary !py-1 text-xs"
            onClick={() => setModal({ open: true })}
          >
            + Task
          </button>
        }
      />
      <div className="divide-y divide-line">
        {groups
          .filter(([, items]) => items.length)
          .map(([label, items]) => (
            <div key={label}>
              <p className="bg-raised px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {label} · {items.length}
              </p>
              <ul className="divide-y divide-line">
                {items.map((t) => (
                  <li key={t.id} className="group flex items-center gap-1 px-2">
                    <div className="min-w-0 flex-1">
                      <Checkbox
                        checked={t.completed}
                        onChange={(next) =>
                          update('tasks', t.id, {
                            completed: next,
                            completedAt: next ? new Date().toISOString() : undefined,
                          })
                        }
                        label={t.title}
                        sublabel={
                          <span className="capitalize">
                            {t.area} · {formatDuration(t.estimateMin)}
                            {t.date ? ` · ${relativeDay(t.date)}` : ' · no date'}
                          </span>
                        }
                      />
                    </div>
                    {t.priority === 'high' && !t.completed ? (
                      <Badge tone="serious">High</Badge>
                    ) : null}
                    <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton onClick={() => setModal({ open: true, item: t })} label="Edit task">
                        <PencilIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => remove('tasks', t.id)}
                        label="Delete task"
                        tone="danger"
                      >
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {state.tasks.length === 0 ? <EmptyState message="No tasks yet." /> : null}
      </div>
      <TaskForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MeetingsTab() {
  const { state, remove } = useStore();
  const [modal, setModal] = useState<{ open: boolean; item?: Meeting }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);
  const upcoming = useMemo(() => upcomingMeetings(state, today(), 14), [state]);

  return (
    <Card>
      <CardHeader
        title="Next two weeks"
        icon="👥"
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setImportOpen(true)}>
              Import .ics
            </button>
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => downloadIcs(state)}>
              Export .ics
            </button>
            <button
              type="button"
              className="btn-primary !py-1 text-xs"
              onClick={() => setModal({ open: true })}
            >
              + Event
            </button>
          </div>
        }
      />
      {upcoming.length ? (
        <ul className="divide-y divide-line">
          {upcoming.map((m, i) => (
            <li key={`${m.id}-${m.date}-${i}`} className="group flex items-center gap-3 px-4 py-2.5">
              <div className="w-28 shrink-0">
                <p className="text-xs font-medium text-ink-secondary">{relativeDay(m.date)}</p>
                <p className="text-[11px] tabular-nums text-ink-muted">
                  {formatTime(m.startTime)}–{formatTime(m.endTime)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{m.title}</p>
                <p className="truncate text-[11px] capitalize text-ink-muted">
                  {m.kind}
                  {m.location ? ` · ${m.location}` : ''}
                  {m.repeat === 'weekly' ? ' · repeats weekly' : ''}
                </p>
              </div>
              <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton onClick={() => setModal({ open: true, item: m })} label="Edit event">
                  <PencilIcon />
                </IconButton>
                <IconButton onClick={() => remove('meetings', m.id)} label="Delete event" tone="danger">
                  <TrashIcon />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No meetings or club events coming up." />
      )}
      <MeetingForm open={modal.open} onClose={() => setModal({ open: false })} initial={modal.item} />
      <CalendarImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function CoursesTab() {
  const { state, remove } = useStore();
  const [courseModal, setCourseModal] = useState<{ open: boolean; item?: Course }>({ open: false });
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [meetingModal, setMeetingModal] = useState<{
    open: boolean;
    item?: CourseMeeting;
    defaultCourseId?: string;
  }>({ open: false });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Courses"
          icon="📚"
          subtitle="Class times only ever appear on your schedule once you add them here."
          action={
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setSyllabusOpen(true)}>
                📄 Scan syllabus
              </button>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => setMeetingModal({ open: true })}
                disabled={!state.courses.length}
              >
                + Class time
              </button>
              <button
                type="button"
                className="btn-primary !py-1 text-xs"
                onClick={() => setCourseModal({ open: true })}
              >
                + Course
              </button>
            </div>
          }
        />
        {state.courses.length ? (
          <ul className="divide-y divide-line">
            {state.courses.map((c) => {
              const items = state.assignments.filter((a) => a.courseId === c.id);
              const done = items.filter((a) => a.status === 'done').length;
              const times = state.courseMeetings
                .filter((m) => m.courseId === c.id)
                .sort((a, b) => a.weekday - b.weekday || (a.startTime < b.startTime ? -1 : 1));

              return (
                <li key={c.id} className="group px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: `rgb(var(--series-${c.colorSlot}))` }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-[11px] text-ink-muted">
                        {c.code ? `${c.code} · ` : ''}
                        {c.instructor ? `${c.instructor} · ` : ''}
                        {done}/{items.length} assignments done
                      </p>
                    </div>
                    <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton
                        onClick={() => setCourseModal({ open: true, item: c })}
                        label="Edit course"
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton onClick={() => remove('courses', c.id)} label="Delete course" tone="danger">
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-4">
                    {times.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMeetingModal({ open: true, item: m })}
                        className="chip hover:bg-raised"
                      >
                        {WEEKDAY_SHORT[m.weekday]} {formatTime(m.startTime)}–{formatTime(m.endTime)}
                        {m.location ? ` · ${m.location}` : ''}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="chip border-dashed text-ink-muted hover:bg-raised hover:text-ink"
                      onClick={() => setMeetingModal({ open: true, defaultCourseId: c.id })}
                    >
                      + time
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState message="Add your courses so assignments can be color-coded and class times can be scheduled." />
        )}
        <CourseForm
          open={courseModal.open}
          onClose={() => setCourseModal({ open: false })}
          initial={courseModal.item}
        />
        <CourseMeetingForm
          open={meetingModal.open}
          onClose={() => setMeetingModal({ open: false })}
          initial={meetingModal.item}
          defaultCourseId={meetingModal.defaultCourseId}
        />
        <SyllabusImportModal open={syllabusOpen} onClose={() => setSyllabusOpen(false)} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function GradesTab() {
  const { state } = useStore();
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(state.courses[0]?.id);
  const [catModal, setCatModal] = useState<{ open: boolean; item?: GradeCategory }>({ open: false });
  const [entryModal, setEntryModal] = useState<{ open: boolean; item?: GradeEntry; categoryId?: string }>({
    open: false,
  });
  const [targetGrade, setTargetGrade] = useState('90');

  if (!state.courses.length) {
    return (
      <Card>
        <CardHeader title="Grades" icon="🎓" />
        <EmptyState message="Add a course under Courses first — grades attach to a course." />
      </Card>
    );
  }

  const course = state.courses.find((c) => c.id === selectedCourseId) ?? state.courses[0];
  const grade = courseGrade(state, course.id);
  const target = Number(targetGrade);
  const needed = Number.isFinite(target) ? neededAverage(grade, target) : null;

  return (
    <Card>
      <CardHeader title="Grades" icon="🎓" subtitle="Weighted by category, straight from the syllabus." />
      <div className="card-pad">
        <div className="scroll-x mb-4">
          <div className="flex gap-1.5">
            {state.courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCourseId(c.id)}
                className={cx(
                  'chip whitespace-nowrap',
                  c.id === course.id ? 'border-brand bg-brand/10 text-brand' : 'hover:bg-raised',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-raised px-4 py-3">
          <div>
            <p className="text-xs text-ink-muted">Current grade</p>
            <p className="hud-mono text-2xl font-semibold text-ink">
              {grade.pct != null ? `${grade.pct.toFixed(1)}%` : '—'}
              {grade.pct != null ? (
                <span className="ml-2 text-base text-ink-secondary">{letterGrade(grade.pct)}</span>
              ) : null}
            </p>
          </div>
          {grade.byCategory.length ? (
            <p className="max-w-[16rem] text-right text-xs text-ink-muted">
              {grade.weightCounted}% of the syllabus weight has grades in it so far.
            </p>
          ) : null}
        </div>

        {grade.byCategory.length ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              Target grade
              <input
                type="number"
                min={0}
                max={100}
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="input w-16 !py-1 text-center"
              />
              %
            </label>
            <p className="hud-mono text-xs text-ink-secondary">
              {needed === null ? (
                <span className="text-ink-muted">Every category is already graded.</span>
              ) : !needed.achievable ? (
                <span className="text-critical">Not reachable — even 100% on the rest falls short.</span>
              ) : (
                <>
                  Need <span className="font-semibold text-ink">{Math.max(0, needed.value).toFixed(1)}%</span> average
                  on the remaining {(grade.totalWeight - grade.weightCounted).toFixed(0)}% of the grade.
                </>
              )}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          className="btn-ghost mb-3 !py-1 text-xs"
          onClick={() => setCatModal({ open: true })}
        >
          + Category
        </button>

        {grade.byCategory.length ? (
          <div className="space-y-3">
            {grade.byCategory.map(({ category, entries, avgPct }) => (
              <div key={category.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{category.name}</p>
                    <p className="text-[11px] text-ink-muted">{category.weightPct}% of grade</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="hud-mono text-sm text-ink-secondary">
                      {avgPct != null ? `${avgPct.toFixed(1)}%` : 'no grades yet'}
                    </span>
                    <IconButton onClick={() => setCatModal({ open: true, item: category })} label="Edit category">
                      <PencilIcon />
                    </IconButton>
                  </div>
                </div>
                {entries.length ? (
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {entries.map((e) => (
                      <li key={e.id} className="flex items-center justify-between py-1.5 text-xs">
                        <button
                          type="button"
                          className="text-ink-secondary hover:text-ink"
                          onClick={() => setEntryModal({ open: true, item: e, categoryId: category.id })}
                        >
                          {e.label}
                        </button>
                        <span className="hud-mono text-ink-muted">
                          {e.score}/{e.maxScore}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="btn-quiet mt-2 !px-2 !py-1 text-xs"
                  onClick={() => setEntryModal({ open: true, categoryId: category.id })}
                >
                  + Grade
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Add categories from the syllabus — Homework, Midterm, Final — and their weights." />
        )}
      </div>

      <GradeCategoryForm
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        initial={catModal.item}
        courseId={course.id}
      />
      {entryModal.categoryId ? (
        <GradeEntryForm
          open={entryModal.open}
          onClose={() => setEntryModal({ open: false })}
          initial={entryModal.item}
          categoryId={entryModal.categoryId}
        />
      ) : null}
    </Card>
  );
}
