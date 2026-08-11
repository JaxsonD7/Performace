# Performace

A local-first personal performance tracker: diet, sleep, gym, reading, school,
meetings, the Orthodox rule of life, Apple Watch metrics, and a day planner that
turns all of it into an actual schedule.

Everything lives in your browser. No account, no server, no network calls.

```bash
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produces a static `dist/` you can open anywhere.

The app ships with two weeks of sample data so every card, streak, and chart has
something to show on the first launch. Replace it from **Settings → Your data**
("Erase everything" keeps the default checklist and Orthodox rule so the app
still works).

## What's in it

| Page | What it does |
|---|---|
| **Today** | The whole day on one screen: generated schedule, sleep, gym, meals + water, watch metrics, Orthodox rule, school, tasks, meetings, reading, evening reflection |
| **Schedule** | Day planner with a week strip. Build, edit, reorder, and tick off blocks |
| **School & Tasks** | Assignments, tasks, meetings/clubs, and courses |
| **Health & Gym** | Workout log with per-set tracking, sleep log, meal log, watch metrics |
| **Reading** | Sessions, the shelf, per-book progress |
| **Goals & Rule** | Goals by life area, the Orthodox rule, and a habit grid you can back-fill |
| **Metrics** | The weekly view: streaks, sleep trend, workout consistency, reading, school load, missed tasks, upcoming meetings, rule consistency |
| **Settings** | Your daily rhythm, targets, theme, and data export/import |

### The daily checklist

The ten actions from the brief ship as habits: wake up on time, morning prayer,
read, workout, eat clean, drink water, finish school work, attend meetings,
evening reflection, sleep on time. Add, edit, or remove any of them.

### The Orthodox rule

Prayer rule, scripture reading, spiritual reading, fasting, church attendance,
confession preparation, gratitude, avoiding bad habits, and acts of service —
each with its own weekly target and streak. Fasting defaults to twice a week
(Wednesday and Friday), church to once.

### The schedule generator

`src/lib/schedule.ts` is a pure `(state, date) → blocks` function. It works in
priority order:

1. **Blocks you made or edited by hand are never moved.** Editing a generated
   block marks it manual, so it survives every rebuild.
2. **Meetings** are placed as fixed commitments.
3. **Class time** is reserved on weekdays from your school hours, split around
   lunch so lunch still has somewhere to go.
4. **Anchors** — wake-up, prayer rule, meals, workout, reading, wind-down — go at
   their configured times. If something is in the way they slide to the nearest
   opening, but only so far: a workout may move across the evening, a breakfast
   that would land at 3pm is dropped instead, because a schedule that lies is
   worse than one with a gap.
5. **Remaining gaps** fill with school work (soonest due date first), then tasks,
   cut into focus blocks with breaks between.

Ticking off a block flows back to the record it came from — completing a task
block completes the task.

## Data

One JSON document in `localStorage`, versioned and migrated on load. Every
record is flat, serializable, and dated with a local `YYYY-MM-DD` string, which
is what makes the storage swap below a one-file change.

`src/data/persistence.ts` defines the only seam between the app and where bytes
live:

```ts
export interface Persistence {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}
```

To move to IndexedDB, SQLite, or a sync server, write one more implementation
and change the last line of that file. No component or hook changes.

Export a full JSON backup, restore from one, or export any table as CSV from
**Settings → Your data**. PDF goes through the browser's print dialog, which has
a print stylesheet that strips the app chrome.

## Where the next features plug in

| Feature | Where |
|---|---|
| Apple Health / Apple Watch, Garmin, Fitbit import | `src/integrations/health` — implement `HealthImporter.parse`; imported days become ordinary `HealthMetric` records |
| Calendar import | `src/integrations/calendar` — parse `.ics` into `Meeting`s, which the planner already treats as fixed |
| Notifications | `src/integrations/notifications` — turn a day's blocks into reminders |
| AI-generated schedules | `src/integrations/ai` — implement `DayPlanner.plan`; same signature as the built-in planner, so the pages pick it up unchanged |
| More charts | `src/components/ui/charts.tsx` — `BarChart`, `StatTile`, `WeekDots` are shared primitives |

### Apple Watch Ultra

Metrics are entered by hand for now (Health & Gym → Watch), and the schema
already carries what the watch measures: steps, active calories, exercise
minutes, stand hours, resting heart rate, HRV, VO₂ max, respiratory rate, and
wrist temperature deviation. When you want the import:

1. iPhone → Health → your profile → **Export All Health Data** → `export.zip`
2. Unzip and take `apple_health_export/export.xml`
3. Implement `appleHealthImporter.parse` in `src/integrations/health/index.ts` —
   the record types to read are listed in the comment above it — and merge with
   `mergeHealth`

## Layout

```
src/
  types.ts                 the whole domain model
  data/                    persistence seam, defaults, sample data
  store/                   reducer, context, and the common write actions
  lib/                     date math, selectors, schedule generator, metrics
  components/
    ui/                    cards, inputs, checkboxes, progress bars, charts
    forms/                 one modal per entity, all sharing a draft hook
    today/                 the dashboard cards
    schedule/              the shared block list
  pages/                   one file per route
  integrations/            health, calendar, notifications, AI, export
```

## Stack

React 18, TypeScript, Vite, Tailwind, React Router. No UI kit, no chart library,
no state library, no backend.

Colors are RGB-channel CSS custom properties in `src/index.css`, so light and
dark are each defined once and Tailwind's alpha modifiers work against them. The
categorical palette is fixed-order and colorblind-checked; a color always
follows the entity (prayer is violet, the gym is orange) and never its rank.
