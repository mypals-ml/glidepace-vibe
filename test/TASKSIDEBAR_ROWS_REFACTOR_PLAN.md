# Test Plan: Split TaskSidebarRows.tsx Refactor

**Task:** Refactor the oversized `src/components/Dashboard/TaskSidebarRows.tsx` (617 LOC) by splitting into focused component files: `TaskGroupRow.tsx` and `SortableTaskRow.tsx`.

**Date:** 2026-06-22
**Goal:** Reduce file size for better maintainability and separation of concerns (per RULES.md), without changing behavior or introducing bugs.

## Pre-Conditions / Baseline
- Current branch: develop
- Working tree clean (pre-refactor snapshot)
- All source in `src/components/Dashboard/`

## Why This File
- Contains two large memoized row renderers (`TaskGroupRow` ~170 LOC body, `SortableTaskRow` ~260 LOC body) + shared `TreeTitleCell` (~100 LOC) + constants.
- Violates "Keep files focused and split functions by features".
- Other large files (e.g. TaskSidebar 673, githubService 668) are either orchestrators or API facades harder to carve without broader redesign.
- Split is mechanical extraction of pure presentation code.

## Test Strategy
- **No behavioral changes:** Pure move of JSX + hooks/state inside components. Callbacks/props interfaces unchanged.
- **Automated first:** Unit tests + compile checks catch most issues.
- **Manual UI validation:** Use mock mode for deterministic data and full render paths.
- Focus areas: rendering, interactions delegated to parent (via callbacks), styling/conditional classes, accessibility attrs, tree visuals.

## Test Plan Steps (Execute in Order)

### 1. Pre-Refactor Baseline (MUST pass before editing code)
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run type-check
npm run lint
npm test -- TaskSidebar TaskSidebarContextMenu taskSidebarTree --run
npm run build
```
- Record pass/fail + any warnings.
- If any failure, abort refactor.

### 2. Perform Split
- Create `src/components/Dashboard/TaskGroupRow.tsx` (includes shared: ContextMenuTarget type, assignee chip consts, TreeTitleCell impl, TaskGroupRow).
- Create `src/components/Dashboard/SortableTaskRow.tsx` (imports shared pieces from TaskGroupRow, implements SortableTaskRow).
- Update imports in:
  - `src/components/Dashboard/TaskSidebar.tsx`
  - `src/components/Dashboard/TaskSidebarContextMenu.tsx`
- Delete `src/components/Dashboard/TaskSidebarRows.tsx`
- Verify no other references remain (grep).

### 3. Post-Split Automated Checks (run immediately after edits)
Run exact same commands as step 1.
- `npm run type-check`
- `npm run lint`
- `npm test -- TaskSidebar TaskSidebarContextMenu taskSidebarTree --run`
- `npm run build`
- Additionally:
  - `npm run verify` (runs check.sh + lint)
  - Full targeted: `npm test -- src/components/Dashboard/TaskSidebar.test.tsx src/components/Dashboard/TaskSidebarContextMenu.test.tsx -run`

Expect: same results as baseline (or better if any prior flakiness).

### 4. Manual / Integration UI Verification (in Mock Mode)
Use `npm run dev:test` (sets VITE_USE_MOCK_DATA=true, project PVT_2/PVT_3).

Key scenarios to manually exercise (or script if possible):
- Sidebar renders on load with synthetic root + real groups + tasks in tree hierarchy.
- TreeTitleCell visuals:
  - Depth-based colors and elbow SVG connectors for nested items.
  - Toggle button for groups (expand/collapse icon state + aria).
- TaskGroupRow:
  - Synthetic root styling (different bg, no drag/rename).
  - Click to toggle expand.
  - Context menu (right-click or ...) for Rename / Ungroup (non-root).
  - Hover shows action toolbar (edit + folder_off).
  - Drag handle only for non-root.
  - Drop target ring styles when dragging tasks onto group.
- SortableTaskRow:
  - Display: displayId + title (strikethrough for Done), status chip + dot, assignee avatars (+N), dates.
  - Status picker popup via click on status badge.
  - Assignee picker popup.
  - Link icon + center icon + more (...) hover actions.
  - Link mode: special bg/ring when selected for linking.
  - Selected highlight bar.
  - Context menu target for tasks.
  - Jump to chart from action.
- Cross concerns:
  - Search query in parent filters rows (rows themselves don't filter).
  - DND: attributes/listeners passed through (visual drag state, though actual reorder tested via TaskSidebar.test).
  - Mobile vs desktop classes (touchAction etc).
  - i18n: all t() calls resolve (no missing keys introduced).
  - No console errors/warns on interactions.
- Edge:
  - First task row has link button positioned differently (top vs bottom toolbar).
  - Tasks with 0/3+/assignees render correctly.
  - Long titles, special chars.

If dev server used: also spot check switching projects, different groupings via UI if available.

### 5. Regression Guards
- Existing TaskSidebar.test.tsx, taskSidebarTree.test.ts, context menu tests must continue to import and pass (they test higher or utils).
- No changes to exported public API surface for rows (type ContextMenuTarget still resolvable via updated path).
- Snapshot or visual: if any CSS module/class changes accidentally, build would surface, and manual catches.

### 6. Cleanup / Final Verification
- `git status` shows only intended new files + deletes + import updates.
- Run full `npm test` (quick, since vitest) if any doubt.
- Update any plan docs if they hard-ref the old filename (but historical plans in plan/ are archival; skip).

### Success Criteria
- All automated checks identical pass/fail to baseline.
- UI renders and basic interactions (pickers, context, collapse, hovers) identical in mock mode.
- No TypeScript errors, no lint, successful prod build.
- Files now < ~350 LOC each.
- Can push without breaking CI assumptions (lint/type/build).

### Rollback
If any step fails post-edit and cannot be quickly fixed: `git checkout -- src/components/Dashboard/` + rm new files, restore original.

## Notes
- Refactor is extraction only: all internal state, event handlers, className logic, t() keys, data-* attrs preserved verbatim.
- Mocks used via env ensure no network side effects.
- This plan lives in `test/` per project rules for test documentation.
