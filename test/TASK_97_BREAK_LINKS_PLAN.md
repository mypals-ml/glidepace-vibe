# Task #97 Implementation and Test Plan

## Scope

Refine the task list context-menu break-link behavior so users can:

- break all links for the current task or visible group boundary
- break only predecessor links
- break only successor links
- only see break-link actions when the corresponding links exist

## Implementation Plan

1. Add a pure helper in `src/lib/` that inspects the current task list plus a boundary task pair and returns:
   - whether predecessor links exist
   - whether successor links exist
   - the `updateTaskSuccessors` operations needed for `all`, `predecessors`, or `successors`
2. Replace the ad-hoc unlink logic in `src/components/Dashboard/TaskSidebar.tsx` with the helper output.
3. Expand the context menu UI to show:
   - `Break All Links` when any related links exist
   - `Break with Predecessors` only when predecessor links exist
   - `Break with Successors` only when successor links exist
4. Add i18n keys for the two new labels across supported locales.
5. Update `docs/FEATURES.md` to reflect the refined dependency-break actions.

## Test Plan

1. Add unit tests for the new helper covering:
   - task-level break-all operations remove inbound and outbound links
   - predecessor-only operations leave successor links untouched
   - successor-only operations leave predecessor links untouched
   - group boundary operations use the first task for predecessors and the last task for successors
   - visibility flags are false when no matching links exist
2. Run targeted Vitest coverage for the helper tests.
3. Run required repo verification:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`

## Review Notes and Risks

- The sidebar still persists each affected task through separate `updateTaskSuccessors` calls, so multi-source unlinking is not globally atomic across GitHub writes.
- This change intentionally reuses the existing persistence path instead of introducing a new batch mutation layer, which keeps the implementation small and aligned with current architecture.
