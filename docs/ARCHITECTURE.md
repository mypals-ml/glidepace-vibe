# Glidelines Architecture

## Core Stack
*   **Framework:** React with Vite
*   **Styling:** Tailwind CSS (with responsive container queries & dynamic themes)
*   **Language:** TypeScript
*   **Mobile Support:** Capacitor (Cross-platform Web/Mobile wrapper)
*   **Real-time Layer:** Supabase (Broadcast channels for instant webhook relay)
*   **Localization:** i18next (supports English, Japanese, and Simplified Chinese)
*   **Data Source:** GitHub GraphQL API (Projects V2)

## Key Modules
1.  **Auth Layer:** Manages GitHub OAuth authentications. Supports storing multiple connected GitHub accounts in `localStorage` and switching between an active account seamlessly.
2.  **GitHub Service (API layer):** Wraps generic GraphQL queries/mutations to fetch issues, projects, items, and custom fields. Also includes a serverless backend (`/api/github-oauth-callback`) for safe token exchange and (`/api/github-webhook`) for processing real-time events.
3.  **Real-time Sync (Supabase Relay):** A secure middleware that receives GitHub webhooks, verifies signatures, and broadcasts event payloads via Supabase channels to all connected browser clients.
4.  **Cascade Engine (Core Utilities):** Foundation logic for date math and dependency calculations. Currently provides core utilities in `src/lib/dateUtils.ts` to calculate end dates and shift timelines.
5.  **Frontend/Gantt UI:** The visual component to render timelines, handle drag-and-drop actions, and visualize tasks. Features a split-pane layout with an Issue List on the left and a Gantt Chart on the right.
6.  **Project Management:** A dedicated modal UI to discover and select GitHub projects directly attached to the authorized user's active account. Includes a local history of recently opened projects.
7.  **Mock/Demo Layer:** A robust set of mock services and dummy data (`src/lib/githubMock.ts`) that allows for local development, testing, and a "Demo Mode" without requiring a live GitHub connection.

## Data Flow

```
GitHub GraphQL API
       ↓
githubService.ts (real or mock based on VITE_USE_MOCK_DATA / token value)
       ↓
DashboardProvider.tsx (global state via React Context — 47KB, the core brain)
       ↓
Components consume via useDashboard() hook
```

Real-time updates flow through: GitHub Webhook → `/api/github-webhook.ts` (Vercel) → Supabase broadcast → DashboardProvider subscription.

## Key Directories

- `src/context/` — `DashboardProvider.tsx` holds all application state and GitHub API calls. `DashboardContext.ts` has the type definitions.
- `src/lib/` — `githubService.ts` (GraphQL wrapper), `githubMock.ts` (23KB mock handler), `githubTaskMapper.ts` (converts GitHub GraphQL responses to `Task` types), `dateUtils.ts` (Gantt date math).
- `src/components/` — Feature-organized: `Header/`, `Dashboard/` (Sidebar + Timeline), `Modals/`.
- `src/types/index.ts` — All shared types. Always add types here, not inline.
- `api/` — Vercel serverless functions: OAuth callback, webhook receiver, GitHub App installation check.
- `vite-plugin-vercel-mock.ts` — Custom Vite plugin that mocks `/api` routes locally.
