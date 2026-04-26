# [Planning] Level Up a Task

This document describes the UI design for leveling up a task, promoting it from a subtask to a top-level task or moving it out from under its current parent.

## Elements

### 1. "Level Up" Button or Icon

Each subtask in the task list will have a "Level Up" button or icon (e.g., a left-facing arrow). This action is only available for tasks that are currently subtasks (i.e., have a parent task).

### 2. Visual De-indentation

When a task is leveled up, its visual indentation in the task list will be removed, aligning it with its former parent task.

### 3. Hierarchy Update

The project's task hierarchy will be updated to reflect the change. The leveled-up task is no longer a child of its former parent and becomes a sibling to it. Any subtasks of the leveled-up task will move with it, maintaining their relationship to their parent.
