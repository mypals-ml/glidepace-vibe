# [Implemented] Task List View Elements

This document defines the columns and interactive elements within the Task List (left pane of the dashboard).

## Columns

| Column | Description | Data Source |
| :--- | :--- | :--- |
| **Status** | Visual indicator of task progress (e.g., Todo, In Progress, Done). | GitHub Project Status field |
| **Title** | The name of the issue or draft task. | GitHub Issue Title |
| **Assignees** | Avatars of users assigned to the task. | GitHub Issue Assignees |
| **Start Date** | The date the task is scheduled to begin. | Custom Field (Date) |
| **Finish Date** | The date the task is scheduled to end. | Custom Field (Date) |

## Interactive Elements

### 1. Assignee Picker
- Clicking the assignee area opens a searchable dropdown.
- **Project Mates** are prioritized in the list.
- Supports global GitHub user search for public projects.

### 2. Date Pickers
- Clicking a date cell opens a calendar picker.
- Changes are instantly synced back to GitHub.

### 3. Task Status Toggle
- Status icons can be clicked to cycle through status values (Planning).
- Current implementation shows read-only status icons.

### 4. Create Task Button
- Located at the top of the list.
- Opens the "Add Task" modal.
