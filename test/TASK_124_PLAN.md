# Task 124 Plan

## Root cause

The row location button now calls the full jump-to-chart flow and pending requests are no longer cleared by timeout. Browser reproduction showed a second failure: after horizontal centering started with `scrollTo({ left, behavior: 'smooth' })`, the task row alignment immediately called `scrollTo({ top, behavior: 'auto' })` on the same Gantt scroller. That second call cancelled the pending horizontal scroll, so the request completed while the chart stayed on the old date.

## Implementation

1. Make `centerOnDate` return whether it actually scrolled the timeline.
2. Return `false` when timeline expansion is required and let the pending Gantt request survive until the expanded timeline is applied.
3. Have `GanttChart` retry the pending request from the applied timeline-expansion signal and complete it only after horizontal centering succeeds and task row scrolling, when requested, has run.
4. Align the task row by assigning `scrollTop` directly instead of issuing a second `scrollTo()` call that can cancel horizontal centering.
5. Add regression coverage for deferred task focus requests and for row alignment not calling `scrollTo()`.

## Verification

1. Run focused Gantt chart tests.
2. Run the full test suite.
3. Run `npm run lint`, `npm run type-check`, and `npm run build`.
