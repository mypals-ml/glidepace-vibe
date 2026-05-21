# Test Case: Task Reordering and Positioned Creation

Verify that the task sidebar can reorder GitHub Project items and create tasks above or below an existing task.

## Prerequisites
1. Run the application in mock mode: `npm run dev:test`
2. Open `http://localhost:5173`
3. Open the "Connected GitHub Tasks" mock project.

## Drag Reorder
1. Hover a task row in the sidebar.
2. Drag the row by the drag handle.
3. Drop it several rows away.
4. Expected: the sidebar order updates immediately, the Gantt rows follow the same order, and a manual refresh keeps the new order.

## Filtered Reorder
1. Type a search query that leaves at least three visible tasks.
2. Drag the last visible task above the middle visible task.
3. Expected: the moved task is inserted relative to the visible neighbor, while hidden tasks are not individually rewritten.

## Mobile Context Menu Creation
1. In mobile width, long-press a task row.
2. Choose "Add task above".
3. Create a task.
4. Expected: the created task appears above the long-pressed task.
5. Repeat with "Add task below".
6. Expected: the created task appears below the long-pressed task.

## Desktop More Menu Creation
1. In desktop width, hover a task row.
2. Click the "more" button in the hover toolbar.
3. Choose "Add task above" or "Add task below".
4. Create a task.
5. Expected: the created task appears in the requested position.
