# Task #98 Implementation and Test Plan

## Scope

Refine long pressing on a task-list item in mobile view so the context menu can open without the browser selecting the row text.

## Implementation Plan

1. Review the task-list row interaction layer in `src/components/Dashboard/TaskSidebar.tsx`.
2. Apply a mobile-only selection guard to task and group rows so touch long-press does not invoke text selection or touch callouts.
3. Keep desktop behavior unchanged and avoid interfering with existing reorder and context-menu behavior.

## Test Plan

1. Run static verification:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
2. Manual behavior target:
   - In mobile view, long-pressing a task-list item should not highlight/select its text.
   - Existing tap, context-menu, and move/reorder flows should still work.

## Review Notes and Risks

- This is a UI-behavior fix, so automated coverage is limited; the main confidence comes from keeping the change mobile-scoped and low-level.
- If mobile browsers still trigger selection despite CSS suppression, the next step would be to add an explicit custom long-press handler for task-list rows similar to the Gantt task bars.
