# Feature Specifications

## Currently Implemented
*   **Connect to GitHub Projects:** Connects to your GitHub.com projects to visualize tasks.
*   **Authentication & Multiple Accounts:** Provides a starting page to authenticate securely via GitHub OAuth. Users can connect multiple GitHub accounts, store them locally, and seamlessly switch between them.
*   **Project Discovery & Selection:** Instead of manually inputting a Project ID, authenticated users can browse their active projects via a dedicated "Open Project" modal, with selections cached in `localStorage`.
*   **Real-time Sync:** Automatically receives updates from GitHub via webhooks and Supabase broadcast, updating the UI instantly without page refreshes.
*   **Localization (i18n):** Fully translated interface supporting English, Japanese, and Simplified Chinese.
*   **Themes:** Supports Light and Dark mode toggling. The default interface is a polished Bright (Light) mode with a glassmorphism aesthetic.
*   **MS Project Style Layout:** The main dashboard uses a resizable split-pane layout: the left panel lists issues (with assignees and status), while the wide right panel displays a horizontal Gantt chart.
*   **Jump to Chart:** Long-pressing or right-clicking a task in the list opens a context menu with "Jump to Chart", switching to the Gantt chart and centering the selected task in view.
*   **Sync Status & Manual Sync:** Automatically tracks the last synchronization time with GitHub and displays it in the header (e.g., "Synced 5 minutes ago"). Users can hover over the status to reveal a "Sync Now" button for manual synchronization.
*   **Robust Demo Mode:** Full functionality available offline via mock services (`githubMock.ts`) for testing and demonstration purposes. Supports simulated GraphQL queries and mutations, with in-memory project field persistence for edits such as task dependency links until the app is quit.
*   **Task Dependencies:** Supports finish-to-start successor links between tasks, storing both successor and predecessor text fields so links and unlinks can recalculate affected tasks efficiently. Normal dependency walks auto-correct missing reverse links when one side is discovered, while explicit unlink operations only clear the requested link. Dependency-derived dates cascade through display-only temporary start/target dates so GitHub date fields are not auto-modified. Tasks with GitHub start dates are treated as fixed starts and use a per-project ask/auto display update setting; tasks without GitHub start dates always update their temporary display dates. On mobile, the link tasks builder replaces the active view's bottom control bar instead of floating above the task list or Gantt chart.
*   **Mobile Back Gesture Handling:** In mobile view, browser back gestures first dismiss the active dialog or task detail overlay. If no dialog is open and the user is viewing a chart, the gesture returns to the task list instead of leaving the app.
*   **Assignee Search Strategy:** 
    *   **Contextual Priority:** The search interface automatically prioritizes "Project Mates" — users already assigned to at least one task in the current project for quick access.
    *   **Smart Scoping:** For projects owned by an Organization, the system automatically scopes the GitHub user search to that organization (`org:LOGIN`) to find relevant teammates quickly.
    *   **Global Discovery:** For personal projects that are **public**, the system performs a global GitHub user search using the GraphQL `search(type: USER)` API. For private personal projects, search is restricted to project mates for security.
    *   **Real-time Debounce:** User search occurs dynamically as you type with a 500ms debounce to optimize API calls while providing a responsive "instant search" feel.

## Roadmap & Upcoming Features
*   **Task Grouping:** Group tasks by adding a parent task to them.
*   **Data Persistence (Custom Fields):** Saves the necessary information back in the project, including creating custom attributes for tasks.
*   **Draft Issue Conversion & Setup:** Automated workflow to convert "Draft Issues" to full Issues to enable advanced metadata and dependencies.
*   **Save Gantt Chart as View:** Ability to save the current Gantt configuration as a view in GitHub for easy sharing and persistence.
