# Task Grouping Browser Test and Bug Record

## App Summary

Glidelines is a GitHub Projects planning client that combines an editable task list, Gantt chart, and forecast dashboard. It adds scheduling, dependencies, comments, ordering, persistent nested `Group Path` groups, and temporary `Group by Fields` views while syncing changes back to GitHub Projects.

## Test Environment

- Demo mode: `VITE_USE_MOCK_DATA=true` via `vite --mode test`
- Server: `0.0.0.0:5173`
- Embedded-browser URL: `http://192.168.64.5:5173/`
- Demo projects exercised: Alpha Release Tracker (`PVT_1`) and Demo: Bug Tracker (`PVT_2`)

## Bugs Found

### TG-1 — Field grouping leaks between projects

Steps:

1. Open Alpha Release Tracker.
2. Apply `Group by Fields` → `Status` and save.
3. Open Demo: Bug Tracker, which has no saved field grouping.

Observed: Demo: Bug Tracker remains grouped by `Status`.

Expected: A project with no saved field grouping opens with no temporary field grouping. Saved and explicitly empty selections stay isolated per project.

Root cause: the project-change effect only applied non-null saved values and retained the previous project's in-memory selection when the destination key was absent.

### TG-2 — Display-only field headers expose invalid persistent-group actions

Steps:

1. Apply `Group by Fields` → `Status`.
2. Inspect a field-derived header such as `Status: Done`.

Observed: the header exposes a drag handle, Rename, Ungroup, and group context-menu actions even though it is not backed by `Group Path`. Rename/Ungroup are no-ops against the persisted paths, and reordering the synthetic block cannot produce a stable visible order because field groups are derived and sorted.

Expected: field-derived headers remain collapsible and valid task drop targets, but do not expose persistent-group mutation or reorder actions.

Root cause: all non-root group rows shared the same controls, with no distinction between synthetic field prefixes and persisted `Group Path` segments.

### TG-3 — Persisted groups below field headers use display paths for mutations and positioned creation

Steps:

1. Apply `Group by Fields` → `Status` to a project that also has a persisted `Planning` group.
2. Rename or ungroup `Planning`, or create a task relative to the `Planning` group row.

Observed: rename/ungroup compare a visible path such as `Status: Done / Planning` with the raw persisted path `Planning`, so no task path changes. Positioned creation from the group row can derive its destination from the visible path rather than the raw `Group Path` parent.

Expected: display-only field prefixes are removed before persistent group mutations or creation targets are calculated.

Root cause: move-between-group logic already resolved field prefixes, but rename, ungroup, and group-row positioned creation did not use the same field-group context.

## Regression Checklist

- [x] A project with no saved field grouping clears the previous project's selection.
- [x] Returning to a project restores its own saved field grouping.
- [x] Field-derived headers can collapse/expand and remain task drop targets.
- [x] Field-derived headers do not expose drag, rename, ungroup, or context actions.
- [x] Persisted nested groups retain drag, rename, ungroup, and context actions.
- [x] Rename and ungroup work for persisted groups below one or more field prefixes.
- [x] Group-row positioned creation strips field prefixes from the persisted `Group Path`.
- [x] Existing task reordering, group moves, and task-to-group moves remain covered by the full test suite.

## Verification Results

- Grouping-focused tests: 73 passed across `TaskGroupRow`, `TaskSidebar`, `taskGroupUtils`, and `taskOrderUtils`.
- Embedded-browser regression: passed for per-project grouping isolation, saved grouping restoration, field-header controls, project/field-group collapse, and persisted nested-group controls.
- Lint: passed.
- Type check: passed.
- Production build: passed.
- Full suite: 366 passed and 3 unrelated Forecast Dashboard tests failed. The same three failures reproduce when `ForecastDashboard.test.tsx` runs alone: the test expects five loading statuses while the UI renders six, expects removed `Days left` copy, and expects an older forecast dialog title while the UI exposes the burndown-specific title.
