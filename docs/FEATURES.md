# Feature Specifications

## Core Capabilities
*   **Connect to GitHub Projects:** Connects to your GitHub.com projects to visualize tasks.
*   **Authentication & Multiple Accounts:** Provides a starting page to authenticate securely via GitHub OAuth. Users can connect multiple GitHub accounts, store them locally, and seamlessly switch between them.
*   **Project Discovery & Selection:** Instead of manually inputting a Project ID, authenticated users can browse their active projects via a dedicated "Open Project" modal, with selections cached in `localStorage`.
*   **Localization (i18n):** Fully translated interface supporting English, Japanese, and Simplified Chinese.
*   **Themes:** Supports Light and Dark mode toggling. The default interface is a polished Bright (Light) mode with a glassmorphism aesthetic.
*   **MS Project Style Layout:** The main dashboard uses a resizable split-pane layout: the left panel lists issues (with assignees and status), while the wide right panel displays a horizontal Gantt chart.
*   **Task Grouping:** Group tasks by adding a parent task to them.
*   **Task Dependencies:** Specify successor tasks for a task, and the successor tasks will automatically generate their own start and end dates.
*   **Data Persistence:** Saves the necessary information back in the project, including creating custom attributes for tasks.
*   **Draft Issue Conversion & Setup:** If the connected GitHub project contains "Draft Issues", the app will prompt the user to automatically convert them to full Issues to enable dependencies. This prompt explicitly reminds users to:
    1. Ensure "Issues" are enabled in Repository -> Settings -> General.
    2. Set the GitHub Project's "Default Repository" to the connected repo so future tasks map natively.
    If declined or impossible, the app operates in a "Read-Only" mode.
*   **Save the Gantt Chart as a View in GitHub:** Save the Gantt chart as a view in GitHub, making it easy to share the Gantt chart with others, and the view will be used to display the Gantt chart in this application again.
*   **Sync Status & Manual Sync:** Automatically tracks the last synchronization time with GitHub and displays it in the header (e.g., "Synced 5 minutes ago"). Users can hover over the status to reveal a "Sync Now" button for manual synchronization.

