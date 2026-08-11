import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { NextUp, ScheduleList } from '@/components/schedule/ScheduleList';
import { HabitChecklist } from '@/components/today/HabitChecklist';
import {
  HealthCard,
  MealsCard,
  MeetingsCard,
  ReadingCard,
  ReflectionCard,
  SchoolCard,
  SleepCard,
  TasksCard,
  WorkoutCard,
} from '@/components/today/cards';
import { HabitForm } from '@/components/forms/entryForms';
import { Card, CardHeader, Progress } from '@/components/ui/primitives';
import { formatDate, nowClock, today } from '@/lib/date';
import { dayScore } from '@/lib/metrics';
import { generateSchedule, nextBlock, protectedBlocks } from '@/lib/schedule';
import { openAssignments, overdueTasks, selectDay } from '@/lib/selectors';
import { useStore } from '@/store/store';
import type { Habit } from '@/types';

export function TodayPage() {
  const { state, setBlocks } = useStore();
  const date = today();
  const day = useMemo(() => selectDay(state, date), [state, date]);
  const score = dayScore(state, date);
  const upcoming = useMemo(() => openAssignments(state), [state]);
  const overdue = useMemo(() => overdueTasks(state, date), [state, date]);
  const next = nextBlock(day.blocks, nowClock());

  const [habitModal, setHabitModal] = useState<{ open: boolean; habit?: Habit; group: Habit['group'] }>(
    { open: false, group: 'improvement' },
  );

  const buildDay = () =>
    setBlocks(date, generateSchedule(state, date, { keep: protectedBlocks(day.blocks) }));

  const orthodoxDone = day.orthodoxHabits.filter((h) => day.habitLogs.get(h.id)?.done).length;
  const checklistDone = day.improvementHabits.filter((h) => day.habitLogs.get(h.id)?.done).length;

  return (
    <>
      <PageHeader
        title={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
        subtitle={
          state.settings.name
            ? `${greeting()}, ${state.settings.name}. ${score.done} of ${score.total} done today.`
            : `${greeting()}. ${score.done} of ${score.total} done today.`
        }
        actions={
          <>
            <Link to="/schedule" className="btn-ghost">
              Full schedule
            </Link>
            <button type="button" className="btn-primary" onClick={buildDay}>
              Build my day
            </button>
          </>
        }
      >
        <div className="max-w-md">
          <Progress value={score.pct} label="Day completion" hint={`${score.pct}%`} />
        </div>
      </PageHeader>

      <PageBody>
        <NextUp block={next} />

        <div className="grid gap-4 xl:grid-cols-3">
          {/* Column 1 — the plan */}
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                title="Today's schedule"
                icon="▤"
                subtitle={`${day.blocks.filter((b) => b.completed).length}/${day.blocks.length} blocks done`}
                action={
                  <button type="button" className="btn-quiet !px-2 !py-1 text-xs" onClick={buildDay}>
                    Regenerate
                  </button>
                }
              />
              <div className="max-h-[560px] overflow-y-auto">
                <ScheduleList
                  blocks={day.blocks}
                  emptyMessage='No plan yet — hit "Build my day" to lay one out.'
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Daily improvement"
                icon="✅"
                subtitle={`${checklistDone}/${day.improvementHabits.length} checked`}
                action={
                  <button
                    type="button"
                    className="btn-quiet !px-2 !py-1 text-xs"
                    onClick={() => setHabitModal({ open: true, group: 'improvement' })}
                  >
                    + Habit
                  </button>
                }
              />
              <HabitChecklist
                habits={day.improvementHabits}
                logs={day.habitLogs}
                date={date}
                onEdit={(habit) => setHabitModal({ open: true, habit, group: habit.group })}
              />
            </Card>

            <ReadingCard day={day} />
          </div>

          {/* Column 2 — body */}
          <div className="min-w-0 space-y-4">
            <SleepCard day={day} />
            <WorkoutCard day={day} />
            <MealsCard day={day} />
            <HealthCard day={day} />
            <ReflectionCard day={day} />
          </div>

          {/* Column 3 — soul, school, and the rest */}
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                title="Orthodox rule"
                icon="✝️"
                subtitle={`${orthodoxDone}/${day.orthodoxHabits.length} kept today`}
                action={
                  <button
                    type="button"
                    className="btn-quiet !px-2 !py-1 text-xs"
                    onClick={() => setHabitModal({ open: true, group: 'orthodox' })}
                  >
                    + Practice
                  </button>
                }
              />
              <HabitChecklist
                habits={day.orthodoxHabits}
                logs={day.habitLogs}
                date={date}
                onEdit={(habit) => setHabitModal({ open: true, habit, group: habit.group })}
              />
            </Card>

            <SchoolCard day={day} upcoming={upcoming} />
            <TasksCard day={day} overdue={overdue} />
            <MeetingsCard day={day} />
          </div>
        </div>
      </PageBody>

      <HabitForm
        open={habitModal.open}
        onClose={() => setHabitModal({ open: false, group: 'improvement' })}
        initial={habitModal.habit}
        group={habitModal.group}
      />
    </>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
