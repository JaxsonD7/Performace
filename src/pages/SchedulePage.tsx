import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { BlockForm } from '@/components/forms/logForms';
import { MeetingForm } from '@/components/forms/entryForms';
import { NextUp, ScheduleList } from '@/components/schedule/ScheduleList';
import {
  Card,
  CardHeader,
  ChevronLeft,
  ChevronRight,
  IconButton,
  Progress,
  cx,
} from '@/components/ui/primitives';
import {
  addDays,
  formatDate,
  formatTime,
  isToday,
  nowClock,
  shortDay,
  startOfWeek,
  today,
  weekDates,
} from '@/lib/date';
import { generateSchedule, nextBlock, protectedBlocks } from '@/lib/schedule';
import { selectDay } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { ISODate, ScheduleBlock } from '@/types';

export function SchedulePage() {
  const { state, setBlocks } = useStore();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState<ISODate>(() => searchParams.get('date') || today());
  const [blockModal, setBlockModal] = useState<{ open: boolean; block?: ScheduleBlock }>({
    open: false,
  });
  const [meetingOpen, setMeetingOpen] = useState(false);

  const day = useMemo(() => selectDay(state, date), [state, date]);
  const week = weekDates(startOfWeek(date, state.settings.weekStartsOn));
  const done = day.blocks.filter((b) => b.completed).length;

  const build = () =>
    setBlocks(date, generateSchedule(state, date, { keep: protectedBlocks(day.blocks) }));

  const clear = () => setBlocks(date, protectedBlocks(day.blocks));

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={formatDate(date)}
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={() => setMeetingOpen(true)}>
              + Event
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setBlockModal({ open: true })}
            >
              + Block
            </button>
            <button type="button" className="btn-primary" onClick={build}>
              Build the day
            </button>
          </>
        }
      >
        {/* Week strip — jump between days without leaving the page. */}
        <div className="flex items-center gap-1">
          <IconButton onClick={() => setDate(addDays(date, -7))} label="Previous week">
            <ChevronLeft />
          </IconButton>
          <div className="grid flex-1 grid-cols-7 gap-1">
            {week.map((d) => {
              const blocks = state.blocks.filter((b) => b.date === d);
              const complete = blocks.filter((b) => b.completed).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={cx(
                    'rounded-lg border px-1 py-1.5 text-center transition-colors',
                    d === date
                      ? 'border-brand bg-brand/10'
                      : 'border-line bg-surface hover:bg-raised',
                  )}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-ink-muted">
                    {shortDay(d)}
                  </span>
                  <span
                    className={cx(
                      'block text-sm font-semibold tabular-nums',
                      isToday(d) ? 'text-brand' : 'text-ink',
                    )}
                  >
                    {Number(d.slice(-2))}
                  </span>
                  <span className="mt-0.5 block text-[9px] tabular-nums text-ink-muted">
                    {blocks.length ? `${complete}/${blocks.length}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
          <IconButton onClick={() => setDate(addDays(date, 7))} label="Next week">
            <ChevronRight />
          </IconButton>
        </div>
      </PageHeader>

      <PageBody>
        {isToday(date) ? <NextUp block={nextBlock(day.blocks, nowClock())} /> : null}

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader
              title="Day plan"
              icon="▤"
              subtitle={day.blocks.length ? `${done}/${day.blocks.length} blocks done` : undefined}
              action={
                day.blocks.length ? (
                  <button type="button" className="btn-quiet !px-2 !py-1 text-xs" onClick={clear}>
                    Clear generated
                  </button>
                ) : null
              }
            />
            {day.blocks.length ? (
              <div className="border-b border-line px-4 py-3 sm:px-5">
                <Progress
                  value={done}
                  max={day.blocks.length}
                  label="Progress through the day"
                  hint={`${Math.round((done / day.blocks.length) * 100)}%`}
                />
              </div>
            ) : null}
            <ScheduleList
              blocks={day.blocks}
              showCurrent={isToday(date)}
              onEdit={(block) => setBlockModal({ open: true, block })}
              emptyMessage='Nothing planned. "Build the day" pulls in your meetings, workout, school work, reading, and prayer rule.'
            />
          </Card>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader title="Fixed commitments" icon="👥" />
              <div className="card-pad">
                {day.meetings.length ? (
                  <ul className="space-y-2">
                    {day.meetings.map((m) => (
                      <li key={`${m.id}-${m.date}`} className="flex gap-3 text-sm">
                        <span className="w-16 shrink-0 tabular-nums text-ink-muted">
                          {formatTime(m.startTime)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{m.title}</span>
                          <span className="text-[11px] capitalize text-ink-muted">
                            {m.kind}
                            {m.location ? ` · ${m.location}` : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">Nothing fixed on this day.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="What goes into the plan" icon="✦" />
              <div className="card-pad space-y-2 text-sm text-ink-secondary">
                <Line label="Meetings & church" value={`${day.meetings.length} today`} />
                <Line
                  label="Workout"
                  value={day.workouts.length ? day.workouts[0].title : 'None planned'}
                />
                <Line label="School due soon" value={`${state.assignments.filter((a) => a.status !== 'done').length} open`} />
                <Line
                  label="Homework to place"
                  value={`${state.assignments.filter((a) => a.status !== 'done' && a.schedule).length} opted in`}
                />
                <Line
                  label="Tasks to place"
                  value={`${state.tasks.filter((t) => !t.completed && t.schedule).length} waiting`}
                />
                <Line
                  label="Class times"
                  value={`${state.courseMeetings.length} set`}
                />
                <Line label="Reading goal" value={`${state.settings.readingGoalMin} min`} />
                <p className="pt-2 text-xs text-ink-muted">
                  Nothing here is guessed: classes only show up once you add them under Courses,
                  and homework only gets placed on an assignment where you've turned it on. Blocks
                  you add or edit by hand are marked manual and survive a rebuild — everything else
                  is regenerated from scratch.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </PageBody>

      <BlockForm
        open={blockModal.open}
        onClose={() => setBlockModal({ open: false })}
        initial={blockModal.block}
        date={date}
      />
      <MeetingForm open={meetingOpen} onClose={() => setMeetingOpen(false)} date={date} />
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}
