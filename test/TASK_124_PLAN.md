# Task 124 Plan

## Issue

The task-row hover location button should switch to the Gantt chart and center the matching task bar, but it only sent a center request. When the chart was hidden or another dashboard view was active, the request could be dropped because the Gantt chart was not mounted.

## Implementation

1. Reuse the existing `handleJumpToChart` flow for the hover location button.
2. Keep that flow responsible for selecting the task, closing details, showing the chart, switching to the Gantt view, and then centering on the task start date.
3. Add a regression test that clicks the row location button and verifies the full jump-to-chart sequence.

## Verification

- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run test`
