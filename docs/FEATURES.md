# Feature Specifications

## Currently Implemented
*   **Connect to GitHub Projects:** Connects to your GitHub.com projects to visualize tasks.
*   **Authentication & Multiple Accounts:** Provides a starting page to authenticate securely via GitHub OAuth. Users can connect multiple GitHub accounts, store them locally, and seamlessly switch between them.
*   **Project Discovery & Selection:** Instead of manually inputting a Project ID, authenticated users can browse their active projects via a dedicated "Open Project" modal, with selections cached in `localStorage`.
*   **Real-time Sync:** Automatically receives updates from GitHub via webhooks and Supabase broadcast, updating the UI instantly without page refreshes.
*   **Localization (i18n):** Fully translated interface supporting English, Japanese, and Simplified Chinese.
*   **Themes:** Supports Light and Dark mode toggling. The default interface is a polished Bright (Light) mode with a glassmorphism aesthetic.
*   **MS Project Style Layout:** The main dashboard uses a resizable split-pane layout: the left panel lists issues (with assignees and status), while the wide right panel displays a horizontal Gantt chart.
*   **Sync Status & Manual Sync:** Automatically tracks the last synchronization time with GitHub and displays it in the header (e.g., "Synced 5 minutes ago"). Users can hover over the status to reveal a "Sync Now" button for manual synchronization.
*   **Robust Demo Mode:** Full functionality available offline via mock services and dummy data for testing and demonstration purposes.
*   **Assignee Search Strategy:** 
    *   **Contextual Priority:** The search interface automatically prioritizes "Project Mates" — users already assigned to at least one task in the current project for quick access.
    *   **Smart Scoping:** For projects owned by an Organization, the system automatically scopes the GitHub user search to that organization (`org:LOGIN`) to find relevant teammates quickly.
    *   **Global Discovery:** For personal projects or when teammates aren't found, the system performs a global GitHub user search using the GraphQL `search(type: USER)` API.
    *   **Real-time Debounce:** User search occurs dynamically as you type with a 500ms debounce to optimize API calls while providing a responsive "instant search" feel.

## Roadmap & Upcoming Features
*   **Task Grouping:** Group tasks by adding a parent task to them.
*   **Task Dependencies:** Specify successor tasks for a task, and the successor tasks will automatically generate their own start and end dates based on the dependency graph.
*   **Data Persistence (Custom Fields):** Saves the necessary information back in the project, including creating custom attributes for tasks.
*   **Draft Issue Conversion & Setup:** Automated workflow to convert "Draft Issues" to full Issues to enable advanced metadata and dependencies.
*   **Save Gantt Chart as View:** Ability to save the current Gantt configuration as a view in GitHub for easy sharing and persistence.

