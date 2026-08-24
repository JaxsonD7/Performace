import { useMemo, useState } from 'react';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { BookForm, ReadingForm } from '@/components/forms/logForms';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  PencilIcon,
  Progress,
  TrashIcon,
} from '@/components/ui/primitives';
import { BarChart, StatTile } from '@/components/ui/charts';
import { relativeDay, shortDay, startOfWeek, today } from '@/lib/date';
import { weekSummary } from '@/lib/metrics';
import { useStore } from '@/store/store';
import type { Book, ReadingSession } from '@/types';

const KIND_TONE: Record<Book['kind'], 'brand' | 'good' | 'neutral'> = {
  scripture: 'brand',
  spiritual: 'good',
  school: 'neutral',
  general: 'neutral',
};

export function ReadingPage() {
  const { state, update, remove } = useStore();
  const [sessionModal, setSessionModal] = useState<{ open: boolean; item?: ReadingSession }>({
    open: false,
  });
  const [bookModal, setBookModal] = useState<{ open: boolean; item?: Book }>({ open: false });

  const week = useMemo(
    () => weekSummary(state, startOfWeek(today(), state.settings.weekStartsOn)),
    [state],
  );
  // Assigned course reading (HIST 220's reading responses, etc.) — pulled from
  // the syllabus/classwork, not something logged here. Marking it done just
  // flips the underlying assignment; full editing still lives on School.
  const assignedReading = useMemo(
    () =>
      state.assignments
        .filter((a) => a.type === 'reading' && a.status !== 'done')
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    [state.assignments],
  );
  const sessions = useMemo(
    () => [...state.reading].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 25),
    [state.reading],
  );
  // Books being read float to the top; everything else keeps its order.
  const shelfRank = (b: Book) => (b.status === 'reading' ? 0 : b.status === 'queued' ? 1 : 2);
  const shelf = [...state.books].sort((a, b) => shelfRank(a) - shelfRank(b));

  const daysHit = week.readingMinutes.filter((p) => p.value >= state.settings.readingGoalMin).length;

  return (
    <>
      <PageHeader
        title="Reading"
        subtitle="Scripture, the Fathers, school, and everything else."
        actions={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setBookModal({ open: true })}
            >
              + Book
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setSessionModal({ open: true })}
            >
              + Log reading
            </button>
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="This week" value={week.readingTotalMin} unit="min" />
          <StatTile label="Pages" value={week.pagesRead} />
          <StatTile
            label="Days at goal"
            value={`${daysHit}/7`}
            tone={daysHit >= 5 ? 'good' : 'default'}
          />
          <StatTile
            label="Books going"
            value={state.books.filter((b) => b.status === 'reading').length}
          />
        </div>

        <Card>
          <CardHeader
            title="Minutes read this week"
            icon="📖"
            subtitle={`Goal: ${state.settings.readingGoalMin} minutes a day`}
          />
          <div className="card-pad">
            <BarChart
              data={week.readingMinutes.map((p) => ({
                label: shortDay(p.date),
                value: p.value,
                caption: relativeDay(p.date),
                highlight: p.date === today(),
              }))}
              target={state.settings.readingGoalMin}
              targetLabel="daily goal"
              tone="s3"
              format={(v) => `${Math.round(v)} min`}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Reading to do"
            icon="🎓"
            subtitle={assignedReading.length ? `${assignedReading.length} assigned` : 'From your class syllabi'}
          />
          {assignedReading.length ? (
            <ul className="divide-y divide-line">
              {assignedReading.map((a) => {
                const course = state.courses.find((c) => c.id === a.courseId);
                const overdue = a.dueDate < today();
                return (
                  <li key={a.id} className="group flex items-start gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => update('assignments', a.id, { status: 'done' })}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--series-1))]"
                      aria-label={`Mark ${a.title} done`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{a.title}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {course ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: `rgb(var(--series-${course.colorSlot}))` }}
                              aria-hidden="true"
                            />
                            {course.name}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {overdue ? (
                      <Badge tone="critical">⚠ {relativeDay(a.dueDate)}</Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-ink-secondary">{relativeDay(a.dueDate)}</span>
                    )}
                    <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton onClick={() => remove('assignments', a.id)} label="Delete" tone="danger">
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState message="Nothing assigned right now." />
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="The shelf" icon="📚" />
            {shelf.length ? (
              <ul className="divide-y divide-line">
                {shelf.map((b) => (
                  <li key={b.id} className="group px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{b.title}</p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {b.author ? `${b.author} · ` : ''}
                          <span className="capitalize">{b.kind}</span>
                        </p>
                      </div>
                      <Badge tone={b.status === 'finished' ? 'good' : KIND_TONE[b.kind]}>
                        {b.status === 'finished' ? '✓ Finished' : b.status}
                      </Badge>
                      <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton onClick={() => setBookModal({ open: true, item: b })} label="Edit book">
                          <PencilIcon />
                        </IconButton>
                        <IconButton onClick={() => remove('books', b.id)} label="Delete book" tone="danger">
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </div>
                    {b.totalPages ? (
                      <div className="mt-2">
                        <Progress
                          value={b.currentPage}
                          max={b.totalPages}
                          hint={`${b.currentPage}/${b.totalPages} pages`}
                          label=""
                          tone={b.status === 'finished' ? 'good' : 'brand'}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No books yet. Add one to track its progress." />
            )}
          </Card>

          <Card>
            <CardHeader title="Sessions" icon="🕑" />
            {sessions.length ? (
              <ul className="divide-y divide-line">
                {sessions.map((r) => (
                  <li key={r.id} className="group flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-xs text-ink-muted">
                      {relativeDay(r.date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{r.title}</p>
                      <p className="truncate text-[11px] capitalize text-ink-muted">
                        {r.kind} · {r.minutes} min{r.pages ? ` · ${r.pages} pages` : ''}
                        {r.notes ? ` · ${r.notes}` : ''}
                      </p>
                    </div>
                    <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton
                        onClick={() => setSessionModal({ open: true, item: r })}
                        label="Edit session"
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton onClick={() => remove('reading', r.id)} label="Delete" tone="danger">
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No reading logged yet." />
            )}
          </Card>
        </div>
      </PageBody>

      <ReadingForm
        open={sessionModal.open}
        onClose={() => setSessionModal({ open: false })}
        initial={sessionModal.item}
      />
      <BookForm
        open={bookModal.open}
        onClose={() => setBookModal({ open: false })}
        initial={bookModal.item}
      />
    </>
  );
}
