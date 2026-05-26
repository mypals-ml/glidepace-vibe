# Task #100 Implementation and Test Plan

## Scope

Fix the desktop create-task flow so the right-side panel fully closes after task creation instead of leaving an empty gap where the chart should expand.

## Implementation Plan

1. Trace the desktop create-task panel lifecycle in `src/components/ProjectDashboard.tsx` and `src/components/Dashboard/TaskDetailsPanel.tsx`.
2. Prevent the desktop layout from rendering an empty details-panel shell when create mode is off and there is no selected task to display.
3. Ensure the create-task flow explicitly closes the details panel on success and when the create form is cancelled.
4. Update `docs/FEATURES.md` to document the restored desktop create-task panel behavior.

## Test Plan

1. Run required static verification:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
2. Manual behavior target:
   - In desktop mode, opening create-task should still show the right-side form panel.
   - After successfully creating a task, the panel should close and the Gantt/chart area should expand to fill the freed space.
   - Cancelling create-task should also close the panel without leaving a blank right-side column.
   - Existing task details should still open normally for selected tasks.

## Review Notes and Risks

- The bug comes from UI state coordination rather than data persistence, so static verification is the main automated coverage here.
- The layout guard is intentionally defensive: even if future code forgets to close the details state, the desktop shell should no longer render empty.
