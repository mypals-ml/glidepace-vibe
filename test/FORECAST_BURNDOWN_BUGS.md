# Forecast Burndown Browser Test and Bug Record

## Intended Feature

The Forecast Dashboard converts the currently filtered project tasks into estimated effort, applies the configured remaining-work percentage for each status, and allocates the remaining work across the available team capacity. The burndown chart shows completed work through today and a workday-only projection that reaches zero on the capacity-derived completion date. Supporting cards summarize effort, status totals, and scheduled worker load.

## Test Environment

- Demo mode: `VITE_USE_MOCK_DATA=true` via `npm run dev:test`
- Server: `0.0.0.0:5173`
- Embedded-browser URL: `http://192.168.64.5:5173/`
- Demo projects exercised: Alpha Release Tracker (`PVT_1`) and Demo: Bug Tracker (`PVT_2`)
- VM date/timezone: July 23, 2026, Asia/Tokyo

## Bugs Found

### FB-1 — Available Workers does not affect the forecast

Steps:

1. Open Demo: Bug Tracker in Forecast.
2. Enter Assumptions edit mode.
3. Change Available Workers from 3 to 6.

Observed: team capacity changes from 15 to 30 days/week, but the estimated completion remains August 3 and the projected line still ends on August 3.

Expected: increasing available parallel capacity moves the completion date and projected endpoint earlier.

Root cause: `availableWorkers` was stored and displayed but was absent from `ForecastCompletionAssumptions`, so completion and projection only used the number of allocated assignee entries.

### FB-2 — Todo-equivalent status labels use the Other workload factor

Observed: the UI translates common project statuses such as `To do`, `Backlog`, `Open`, and `Not started` as Todo, but the calculation only recognized the exact compact string `todo`. These statuses therefore used the default Other factor of 50% instead of the Todo assumption of 100%.

Expected: statuses presented as Todo use the configured Todo remaining-work percentage.

Root cause: status display normalization and forecast factor normalization used different alias sets.

### FB-3 — Worker load rows show zero-work phantom bars and duplicate shared work

Steps:

1. Open either seeded demo project in Forecast.
2. Inspect Top worker loads for the next ten days.

Observed: worker rows remain visible even when every day is 0d, and the minimum bar height makes zero load look non-zero. A task with multiple assignees also contributes its full daily estimate to every assignee.

Expected: workers with no scheduled work in the window are omitted. Shared tasks split their scheduled load across assignees, matching the forecast allocation rule.

Root cause: zero-total worker entries were never filtered, and daily task load was copied to each assignee instead of divided by assignee count.

### FB-4 — Demo fallback dates shift one day backward in positive timezones

Steps:

1. Run demo mode in Asia/Tokyo on July 23.
2. Open either demo project's burndown chart.

Observed: the chart starts on July 22 even though the generated fallback task dates represent the current local day.

Expected: the mock GraphQL date fields use a local `YYYY-MM-DD` value and start on July 23.

Root cause: demo date fields used `new Date().toISOString()`, which serializes the previous UTC day before 09:00 in Japan and also returns a timestamp where GitHub date fields return date-only values.

## Regression Checklist

- [x] Available Workers changes both estimated completion and the projected endpoint.
- [x] The no-assignee fallback provides one virtual worker instead of zero capacity.
- [x] Todo, To do, Backlog, Open, and Not started use the Todo assumption.
- [x] Multi-assignee worker load is split rather than duplicated.
- [x] Workers with no load in the next ten days are omitted, and individual zero-load days render at zero height.
- [x] Demo fallback dates use the current local date without a UTC day shift.
- [x] Existing status weighting, overdue-open-task handling, projection-to-zero, assumption editing, and localization remain covered.

## Verification Results

- Forecast-focused tests: 48 passed across dashboard calculations, assumptions, mock mapping, chart utilities, and the Forecast Dashboard component.
- Embedded-browser regression: passed on Alpha Release Tracker and Demo: Bug Tracker. In Alpha, changing Available Workers from 4 to 8 changed team capacity from 20 to 40 days/week and moved both completion and projected zero from August 3 to July 29. Both demos started on the local July 23 date, and zero-load day bars rendered at `height: 0%`.
- Full suite: 44 files and 375 tests passed.
- Lint: passed.
- Type check: passed.
- Production build: passed.
