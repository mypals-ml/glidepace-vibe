# Task 147: Group by Fields Dialog Refinement

## Scope

- Keep the `Group by Fields` dialog height stable while switching between `All fields`, `Used groups`, and `Recommended`.
- Persist the last saved field-group selection separately from the used-group history.
- Reapply the last saved field-group selection on app reload for the active project.
- Preserve an explicitly cleared selection as a valid saved state.

## Implementation Plan

1. Add dedicated `last_used_field_group` storage helpers beside the existing used-group history helpers.
2. Load the saved last selection when `TaskSidebar` renders for a project and apply it through `setSelectedGroupFieldIds`.
3. Save the last selection every time the dialog is saved, including empty selections, while continuing to record non-empty selections in the used-groups history.
4. Give the dialog content panel a stable height and make each tab's inner list scroll within that fixed area.
5. Update feature documentation and add focused unit/component tests for the new persistence behavior.

## Verification

- `npm run test -- src/lib/fieldGroupHistory.test.ts src/components/Dashboard/TaskSidebar.test.tsx`
- `npm run lint`
- `npm run type-check`
- `npm run build`
