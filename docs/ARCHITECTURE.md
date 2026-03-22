# Glidelines Architecture

## Core Stack
*   **Framework:** React with Vite
*   **Styling:** Tailwind CSS (with responsive container queries & dynamic themes)
*   **Language:** TypeScript
*   **Localization:** i18next (supports English, Japanese, and Simplified Chinese)
*   **Data Source:** GitHub GraphQL API (Projects V2)

## Key Modules
1.  **Auth Layer:** Manages GitHub OAuth authentications. Supports storing multiple connected GitHub accounts in `localStorage` and switching between an active account seamlessly.
2.  **GitHub Service (API layer):** Wraps generic GraphQL queries/mutations to fetch issues, projects, items, and custom fields. Uses a serverless backend (`/api/github-oauth-callback`) for safe token exchange.
3.  **Cascade Engine (Core Logic):** Pure functions that take a topological graph of issues (blocked by/blocking), perform date math, and output the required changes.
4.  **Frontend/Gantt UI:** The visual component to render timelines, handle drag-and-drop actions, and visualize tasks. Features a split-pane layout with an Issue List on the left and a Gantt Chart on the right.
5.  **Project Management:** A dedicated modal UI to discover and select GitHub projects directly attached to the authorized user's active account.
