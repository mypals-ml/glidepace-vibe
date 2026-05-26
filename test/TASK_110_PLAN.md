## Task 110 Plan

### Scope
- Refine the `Group by Fields` dialog so selected-field chips keep two-line wrapping for long names while vertically centering shorter names.

### Implementation Plan
1. Update the selected-field chip layout in [`/Users/wanghui/coding/glidepace/glidepace-vibe-1/src/components/Dashboard/TaskSidebar.tsx`](/Users/wanghui/coding/glidepace/glidepace-vibe-1/src/components/Dashboard/TaskSidebar.tsx) to stop top-aligning all content.
2. Keep drag-and-drop and remove-button affordances unchanged.
3. Preserve the existing two-line clamp and word wrapping for long field names.

### Test Plan
1. Run targeted static verification with `npm run lint`, `npm run type-check`, and `npm run build`.
2. Spot-check the selected-field chip markup in the compiled TypeScript path to ensure the alignment classes remain consistent.

### Risks And Gaps Review
- There is no existing focused test harness for `TaskSidebar`, so this pass relies on static verification rather than a component-level DOM assertion.
- The dialog uses utility-class layout only; the main regression risk is accidentally changing icon/button alignment while fixing text centering.
