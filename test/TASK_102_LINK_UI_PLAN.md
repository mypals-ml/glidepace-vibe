# Task #102 Implementation and Test Plan

## Scope

Improve the UI of linking 2 tasks in Gantt chart view:
- When dragging the end connect point of task A to the start connect point of task B, when the mouse moves into the target connector range, the connect line and points should have distinct visual effects (snapping, color changes, size scaling, and pulse animation) prompting the user that they can lift the mouse button to create the link.

## Implementation Plan

1. **State Management**:
   - Introduce a new state `hoveredTargetTaskId` in `GanttChart.tsx` to track the task id of the start connector node being hovered during a drag operation.
   - Clean up `hoveredTargetTaskId` on drag start, drag end, and drop actions.

2. **Track Hover over Start Connector Node**:
   - On the start connector node of each task row, add `onMouseEnter` and `onMouseLeave` event handlers.
   - Only set the `hoveredTargetTaskId` if a drag is active (`linkDragState` is not null) and the target task is different from the source task (`linkDragState.sourceTaskId !== task.id`).

3. **Snap & Enhance Drag Line**:
   - Pass `hoveredTargetTaskId` to the `DependencyLines` component.
   - Inside `DependencyLines.tsx`, check if `hoveredTargetTaskId` is active. If so, locate its coordinates (using the existing `boundsMap`).
   - If bounds exist, snap the ending coordinate of the drag line to the exact center of the target's start connector node (`x1`, `y`) instead of the mouse cursor coordinates.
   - Change the drag line visual style when snapped: change color from indigo to emerald (`#10b981`), keep the line thin, make dash animation faster (`animate-[dash_0.5s_linear_infinite]`), and use an emerald arrowhead.

4. **Enhance Connector Node Visuals**:
   - Inside `GanttChart.tsx`, update the start connector node styles when it is currently hovered (`hoveredTargetTaskId === task.id`).
   - Apply a small scale up (`scale-105`), a subtle ring (`ring-2 ring-emerald-400/80`), emerald background/border color, and make the inner dot pulse (`bg-emerald-500 animate-pulse`).

5. **Documentation**:
   - Update `docs/FEATURES.md` to reflect the improved visual feedback when dragging task links in the Gantt view.

## Test Plan

1. **Static Verification**:
   - Run `npm test` to ensure all existing tests pass.
   - Run `npm run type-check` to ensure 100% type safety.
   - Run `npm run lint` to verify coding standards.
   - Run `npm run build` to verify production build succeeds.

2. **Manual Verification**:
   - Enter Gantt view, hover a task row to reveal the end connector node (blue circle on the right side of the task bar).
   - Click and drag the end connector node. The drag line (dashed line) should follow the mouse pointer.
   - Move the mouse pointer over the start connector node (circle on the left side of another task bar).
   - Verify that:
     1. The drag line snaps directly to the target connector node's center.
     2. The drag line turns green/emerald, remains thin, and its flow animation speeds up.
     3. The target start connector node expands slightly, gets a subtle green ring, and pulses.
   - Lift the mouse button to verify the dependency link is created successfully.
   - Move mouse away without releasing to verify visual state resets cleanly.

## Review Notes and Risks

- **React Event Ordering**: Standard mouse events (`mouseenter` / `mouseleave`) should trigger correctly during dragging as long as pointer capture isn't explicitly claimed by another element.
- **Cleanup**: Ensure `hoveredTargetTaskId` resets on any drop or end gesture to prevent visual glitches.
