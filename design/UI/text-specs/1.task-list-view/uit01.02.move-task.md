# [Planning] Move a Task Up or Down

This document describes the UI design for moving a task up or down in the task list.

## Elements

### 1. "Move Up" and "Move Down" Buttons or Icons

Each task in the task list will have "Move Up" and "Move Down" buttons or icons (e.g., up and down arrows). The "Move Up" button will be disabled for the first task in the list, and the "Move Down" button will be disabled for the last task.

### 2. Task Reordering

*   **Move Up:** Clicking the "Move Up" button will swap the position of the selected task with the task directly above it.
*   **Move Down:** Clicking the "Move Down" button will swap the position of the selected task with the task directly below it.

### 3. Handling of Subtasks

If a task with subtasks is moved, all of its subtasks will be moved along with it, maintaining their hierarchical relationship with the parent task. The entire block of tasks (the parent and its children) will be moved.
