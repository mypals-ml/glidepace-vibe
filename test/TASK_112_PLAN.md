## Task

- Issue: `#112` "Gantt chart display bug"
- Symptom observed from the issue report and current live behavior: opening the Gantt view can land the user far down the task list because a previously saved task selection is treated like a fresh focus request.

## Implementation Plan

1. Separate passive selection restore from explicit Gantt focus requests.
2. Keep `selectedTaskId` persistence, but stop using it to auto-scroll the chart on ordinary project load.
3. Add an explicit task-focus request path for "Jump to Chart" and "Center in Gantt" actions so those flows still center both the date axis and the task row.
4. Update the Gantt view to only perform vertical row scrolling for explicit focus requests.

## Test Plan

1. Add a regression test for the Gantt view proving that a restored `selectedTaskId` does not trigger vertical `scrollTo`.
2. Add a regression test proving an explicit task focus request still scrolls the Gantt row into view.
3. Run `npm run test`, `npm run lint`, `npm run type-check`, and `npm run build`.

## Risks / Gaps Reviewed

- Risk: removing selection-driven auto-scroll could break intentional "jump to chart" flows.
- Mitigation: route those user actions through a dedicated explicit focus request instead of relying on generic selection changes.
