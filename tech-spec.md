# Tech Spec: Project Gantt Chart Viewer

## 1. Overview

This document outlines the technical specifications for the Project Gantt Chart Viewer, a web-based application that provides a Gantt chart visualization for GitHub.com repository projects. The application will connect to a user's GitHub project, display tasks in a Gantt chart format, and allow for task grouping, dependency management, and data persistence back to the GitHub project.

## 2. Architecture

The application will follow a client-server architecture.

*   **Frontend:** A single-page application (SPA) built with a modern JavaScript framework (e.g., React, Vue, or Svelte). The frontend will be responsible for all user interface elements, including the Gantt chart visualization and task management components.
*   **Backend:** A server-side application that will handle communication with the GitHub API, manage data persistence, and provide a RESTful API for the frontend. The backend could be built with a variety of technologies (e.g., Node.js with Express, Python with Flask/Django).

## 3. Data Model

To support the Gantt chart features, the application will need to store additional information with the GitHub project items. This will be achieved by creating custom fields in the GitHub project.

### Custom Project Fields

The following custom fields will be created and associated with each project item (task):

*   **Parent Task:** A text field to store the ID of the parent task. This will be used for task grouping.
*   **Start Date:** A date field to store the start date of the task.
*   **End Date:** A date field to store the end date of the task.
*   **Successor Tasks:** A text field to store a comma-separated list of successor task IDs.

## 4. API

The backend will expose a RESTful API to be consumed by the frontend.

### Endpoints

*   **`POST /api/github/connect`**:
    *   **Description:** Connects to a GitHub repository's project.
    *   **Request Body:**
        *   `repo_url`: The URL of the GitHub repository.
        *   `project_id`: The ID of the GitHub project.
    *   **Response:**
        *   `200 OK`: On successful connection.
        *   `404 Not Found`: If the repository or project is not found.

*   **`GET /api/project/items`**:
    *   **Description:** Retrieves all items (tasks) from the connected GitHub project.
    *   **Response:**
        *   `200 OK`: With a JSON array of project items, including the custom fields.

*   **`PUT /api/project/item/:item_id`**:
    *   **Description:** Updates a specific project item.
    *   **Request Body:** A JSON object with the fields to be updated (e.g., `parent_task`, `start_date`, `end_date`, `successor_tasks`).
    *   **Response:**
        *   `200 OK`: On successful update.
        *   `404 Not Found`: If the item is not found.

## 5. User Interface (UI)

The UI will be clean, intuitive, and focused on providing a clear Gantt chart visualization.

### Key UI Components

*   **GitHub Connection View:** A simple form to input the GitHub repository URL and project ID.
*   **Gantt Chart View:**
    *   Displays tasks on a timeline.
    *   Taskbars will be color-coded to indicate status (e.g., to-do, in-progress, done).
    *   Dependencies will be visualized with arrows connecting tasks.
    *   Task groups will be displayed hierarchically.
    *   Users can drag and drop tasks to change their start and end dates.
*   **Task Editor:**
    *   A modal or side panel that allows users to edit task details.
    *   Fields for editing the task title, description, parent task, start date, end date, and successor tasks.
