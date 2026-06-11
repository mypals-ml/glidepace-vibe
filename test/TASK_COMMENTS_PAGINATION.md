# Test Case: Dynamic Comment Pagination

Verify that when a task with many comments is selected, the application dynamically loads and renders comments page-by-page (30 at a time) in real-time, displaying a spinner until all comments are loaded.

## Prerequisites
1. Run the application in **Mock Mode**: `npm run dev:test`
2. Open the application in the browser at `http://localhost:5173`
3. Open the browser's developer console to watch real-time console log prints.

## Mock Data Baseline
The mock data (defined in `src/lib/githubMock.ts`) provides a dedicated project:
*   **Project**: `100 Comments Demo Project` (ID: `PVT_100_COMMENTS`)
*   **Tasks**: 1 task titled `"Task with 100 comments for pagination testing"` (Item ID: `item-100-comments-1`)
*   **Comments**: Contains exactly 100 mock comments (`comment-100-comments-1` to `comment-100-comments-100`)

---

## Test Steps

### 1. Load the Demo Project
- **Action**: Click the "Open Project" button in the left panel. Select the project **"100 Comments Demo Project"** and click open.
- **Expected**: The board loads containing exactly one task card: `"Task with 100 comments for pagination testing"`. No API calls for comments have been executed yet.

### 2. Open Task Details
- **Action**: Click on the task card to open the right-side task detail panel.
- **Expected**:
  - The detail panel slides in.
  - In the comments section, a loading spinner displays next to the comment count label: **"Comments (0) Loading comments..."**.
  - In the developer console, you will observe the log events indicating the paginated fetch requests executing:
    ```
    [DashboardTasks] 💬 Starting paginated comment fetch for task: item-100-comments-1, contentId: content-100-comments-1
    [DashboardTasks] 💬 Fetching page 1 of comments for item-100-comments-1 (cursor: start)
    [DashboardTasks] 💬 Fetched 30 comments in page 1
    [DashboardTasks] 💬 Fetching page 2 of comments for item-100-comments-1 (cursor: 30)
    [DashboardTasks] 💬 Fetched 30 comments in page 2
    [DashboardTasks] 💬 Fetching page 3 of comments for item-100-comments-1 (cursor: 60)
    [DashboardTasks] 💬 Fetched 30 comments in page 3
    [DashboardTasks] 💬 Fetching page 4 of comments for item-100-comments-1 (cursor: 90)
    [DashboardTasks] 💬 Fetched 10 comments in page 4
    [DashboardTasks] ✅ Finished comment fetch for task item-100-comments-1
    ```

### 3. Verify Dynamic Rendering UI
- **Expected**:
  - The comments count label increments on-screen dynamically as each page is resolved (e.g. from 30 to 60, then 90, then 100).
  - The comment nodes are rendered list-by-list in real-time as they load.
  - The loading spinner vanishes as soon as the final page resolves (`hasNextPage` is false) and the print `"✅ Finished comment fetch"` appears.
  - Confirm the total comment count reaches **100**.

### 4. Interactive Mutations Sync
- **Action**: Type a new comment (e.g., `"Checking dynamic loading updates!"`) in the comments input box at the bottom and click add.
- **Expected**:
  - The comment is immediately prepended/appended locally.
  - A background refresh is triggered, clearing the list and rebuilding it dynamically page-by-page.
  - The comment is successfully integrated with its actual database ID.
