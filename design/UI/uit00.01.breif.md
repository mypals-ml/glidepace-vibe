# [Implemented] Gantt Chart View

This document describes the UI design for the Gantt chart view, which is used to visualize and manage project schedules. The design is based on the Gantt chart functionality in Microsoft Project.

## Elements

The Gantt chart view consists of the following main elements:

### 1. Task List View

The task list is displayed on the left side of the view. It is a hierarchical grid that shows the tasks in the project. Each row in the grid represents a task, and the columns show information about the task, such as the task name, duration, start date, and finish date.

### 2. Timeline View

The timeline is displayed on the right side of the view. It is a graphical representation of the project schedule. The timeline is divided into a series of time intervals, such as days, weeks, or months. Each task is represented by a horizontal bar on the timeline, and the length of the bar represents the duration of the task.

### 3. Dependencies
Dependencies are the relationships between tasks. They are represented by lines that connect the task bars on the timeline. The lines show the order in which the tasks must be performed. For example, a "finish-to-start" dependency means that one task must finish before another task can start.
