## Task 113 Plan

### Scope
- In mobile view, move the textarea resize handle to the center of the bottom edge for task editing surfaces.

### Implementation Plan
1. Introduce a shared `ResizableTextarea` component that preserves desktop behavior while providing a centered custom resize handle on coarse-pointer devices.
2. Replace the existing `textarea` usages in [`/Users/wanghui/coding/glidepace/glidepace-vibe-1/src/components/Dashboard/TaskDetailsPanel.tsx`](/Users/wanghui/coding/glidepace/glidepace-vibe-1/src/components/Dashboard/TaskDetailsPanel.tsx) that rely on the `resizable-textarea` utility class.
3. Update the coarse-pointer CSS so the native bottom-right visual is removed and the new centered handle renders consistently.

### Test Plan
1. Run `npm run lint`, `npm run type-check`, and `npm run build`.
2. Review the updated markup and CSS to ensure the handle is centered without changing desktop resize behavior.

### Risks And Gaps Review
- There is no existing mobile interaction test harness for textarea resizing, so validation in this pass is limited to static verification and implementation inspection.
- The main regression risk is interfering with desktop native resize behavior or textarea focus styles while introducing the centered mobile handle.
