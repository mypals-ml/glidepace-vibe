# [Planning] Level Down a Task

This document describes the UI design for leveling down a task, making it a child of the task directly above it in the task list.

## Elements

### 1. "Level Down" Button or Icon

Each task in the task list will have a "Level Down" button or icon (e.g., a right-facing arrow). This action is only available if the task is not the first task in the list and the task above it is not a child of the current task.

### 2. Visual Indentation

When a task is leveled down, it will be visually indented to the right in the task list, indicating that it is now a subtask of the task above it.

### 3. Hierarchy Update

The project's task hierarchy will be updated to reflect the new parent-child relationship. The leveled-down task is now a subtask of the task that was previously its sibling.
