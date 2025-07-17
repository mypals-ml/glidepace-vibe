# Add a New Task

This document describes the UI design for adding a new task to the project.

## Elements

### 1. "Add Task" Button

A button labeled "Add Task" will be prominently displayed in the task list view. Clicking this button will open a dialog or an inline form for creating a new task.

### 2. New Task Form

The new task form will contain the following fields:

*   **Task Name:** A text input field for entering the name of the new task. This field is required.
*   **Duration:** A numerical input for specifying the task's duration in days.
*   **Start Date:** A date picker for selecting the task's start date.
*   **Finish Date:** A date picker for selecting the task's finish date. This will be automatically calculated based on the start date and duration, but can be manually overridden.
*   **Parent Task:** An optional dropdown or search field to select a parent task, allowing the new task to be created as a subtask.

### 3. "Save" and "Cancel" Buttons

*   **Save:** This button will save the new task and add it to the task list. The form will be validated to ensure all required fields are filled correctly.
*   **Cancel:** This button will close the new task form without saving the task.
