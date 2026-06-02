# Task 124 Plan

## Root cause

The row location button now calls the full jump-to-chart flow and pending requests are no longer cleared by timeout. The remaining failure is that `centerOnDate` expands the timeline when the requested date is outside the mounted range, but the Gantt chart still marks the request complete before the follow-up render performs the actual horizontal center.

## Implementation

1. Make `centerOnDate` return whether it actually scrolled the timeline.
2. Return `false` when timeline expansion is required and let the pending Gantt request survive until the next render.
3. Have `GanttChart` complete a request only after horizontal centering succeeds and task row scrolling, when requested, has run.
4. Add regression coverage for deferred task focus requests.

## Verification

1. Run focused Gantt chart tests.
2. Run the full test suite.
3. Run `npm run lint`, `npm run type-check`, and `npm run build`.
