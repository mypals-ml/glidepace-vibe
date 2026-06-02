# Task 124 Plan

## Root cause

The row location button now calls the full jump-to-chart flow, but the center request is still cleared by `DashboardProvider` after 100ms. When the chart is hidden or switching from another dashboard view, the Gantt chart can mount after that timeout, so it never sees the request.

## Implementation

1. Keep `requestedCenterDate` and `requestedCenterTaskId` pending in the provider until a mounted Gantt chart consumes them.
2. Add an explicit `completeGanttCenterRequest` context callback.
3. Have `GanttChart` call the completion callback after it centers the date and, for task requests, scrolls the matching row.
4. Add regression coverage for task and date-only request acknowledgement.

## Verification

1. Run focused Gantt chart tests.
2. Run the full test suite.
3. Run `npm run lint`, `npm run type-check`, and `npm run build`.
