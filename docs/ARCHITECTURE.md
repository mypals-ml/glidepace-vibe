# Glidelines Architecture (Draft)

## Core Stack
*   **Framework:** TBD (Pending selection)
*   **Styling:** Tailwind CSS
*   **Language:** TypeScript
*   **Data Source:** GitHub GraphQL API (Projects V2)

## Key Modules
1.  **Auth Layer:** Manages GitHub OAuth/PAT authentications.
2.  **GitHub Service (API layer):** Wraps generic GraphQL queries/mutations to fetch issues, projects, items, and custom fields.
3.  **Cascade Engine (Core Logic):** Pure functions that take a topological graph of issues (blocked by/blocking), perform date math, and output the required changes.
4.  **Frontend/Gantt UI:** The visual component to render timelines and handle drag-and-drop actions.
