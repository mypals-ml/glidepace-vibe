## Task 113 Plan

### Scope
- In mobile view, move the textarea resize handle to the center of the bottom edge for task editing surfaces.

### Implementation Plan
1. Use the shared `ResizableTextarea` component that preserves resize behavior while providing a centered custom resize handle.
2. Keep the task detail `textarea` usages in [`/Users/wanghui/coding/glidepace/glidepace-vibe-codex/src/components/Dashboard/TaskDetailsPanel.tsx`](/Users/wanghui/coding/glidepace/glidepace-vibe-codex/src/components/Dashboard/TaskDetailsPanel.tsx) on that component.
3. Update the resize-handle CSS so the square handle's upper border aligns with the textarea's lower border and layout space is reserved below the field.

### Test Plan
1. Run `npm run lint`, `npm run type-check`, and `npm run build`.
2. Review the updated markup and CSS to ensure the handle is centered, lower, and square without changing resize behavior.

### Risks And Gaps Review
- There is no existing mobile interaction test harness for textarea resizing, so validation in this pass is limited to static verification and implementation inspection.
- The main regression risk is interfering with desktop native resize behavior or textarea focus styles while introducing the centered mobile handle.
