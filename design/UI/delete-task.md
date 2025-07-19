# Delete a Task

This document describes the UI design for deleting a task from the project.

## Elements

### 1. "Delete Task" Button or Icon

Each task in the task list will have a "Delete" button or icon associated with it. This may be visible at all times, or appear on hover to reduce visual clutter.

### 2. Confirmation Dialog

To prevent accidental deletion, clicking the "Delete" button will trigger a confirmation dialog with the following elements:

*   **Confirmation Message:** A clear message asking the user to confirm the deletion, for example, "Are you sure you want to delete this task?"
*   **Task Name:** The name of the task to be deleted will be displayed to ensure the user is deleting the correct task.
*   **"Delete" Button:** This button will confirm the deletion and remove the task from the task list.
*   **"Cancel" Button:** This button will close the dialog without deleting the task.

### 3. Deletion of Subtasks

If a task with subtasks is deleted, a warning message will be displayed in the confirmation dialog, for example, "This task has subtasks. Deleting this task will also delete all of its subtasks." The user must confirm this action to proceed.
