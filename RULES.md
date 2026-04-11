# Vibe Coding Rules

This document outlines the core principles and guidelines for developing within the Glidelines project.

## 1. Architecture & Design
*   **Context First:** Always reference `docs/ARCHITECTURE.md` and `docs/FEATURES.md` before making architectural changes.
*   **Multi-Account Architecture:** Respect the design where multiple GitHub accounts are stored in `localStorage`.
*   **Dual-App Sync:** Maintain the separation between OAuth (User Auth) and GitHub App (Background Webhooks).
*   **Separation of Concerns:** Keep files focused and split functions by features at best-efforts into different files. This promotes a clean architecture, enhanced readability, and easier maintainability.
*   **Code Reusability:** When implementing new features, always consider the reusability of components, functions, and utilities across the project to prevent duplication.

## 2. Coding Standards
*   **Strict TypeScript:** 100% type safety is mandatory. No `any` without extreme justification.
*   **Tailwind CSS v4:** Use standard Tailwind v4 utilities. Avoid ad-hoc CSS unless implementing complex animations (glassmorphism, etc.).
*   **No Hardcoded Strings (i18n):** Avoid placing raw hardcoded text strings directly in the source UI code. Use the project's localization system (`i18n.ts`) for user-facing text.
*   **Accessibility (a11y):** Ensure keyboard navigation and proper ARIA labeling for all interactive components.

## 3. Development Workflow
*   **Anchoring Prompts:** When starting new threads, provide a clear "anchor" describing the current project state and immediate goals. See `docs/VIBE_CODING_BEST_PRACTICES.md`.
*   **Incremental Progress:** Make small, atomic, and verifiable changes.
*   **Test-Supported:** Add unit tests for core logical algorithms (specifically the date cascading/math logic) before wiring them up to external UI or APIs.
*   **Documentation Maintenance:** Whenever a new feature is added, modified, or removed, you must update `docs/FEATURES.md` to reflect the latest capabilities.
*   **Post-Task Verification:** Run `npm run type-check` and `npm run build` locally to verify changes before finalizing.

## 4. Version Control & Deployment
*   **Git Branch Flow Constraint:** We NEVER commit and push changes directly to the `release` branch. ALL modifications reaching `release` must originate from a Pull Request generated from the `develop` branch.
*   **Manual Review Required:** Any Pull Request seeking to merge into the `release` branch must be explicitly reviewed and approved by a human manually prior to merging.
*   **Vercel Optimization:** APIs must reside in the `api/` folder for Vercel Serverless Function deployment.

## 5. Testing & Mocks
*   **Logic Tests:** Use Vitest for core date math and dependency calculations (`src/lib/dateUtils.ts`).
*   **Test Documentation:** Save manual test plans and behavior descriptions in the `test/` directory using Markdown files (e.g., `test/SORT_DROPDOWN.md`).
*   **Adding Mock Data:** When new features require authenticated data for testing, add mock fixtures to `src/lib/mockData.ts` and gate them behind the `USE_MOCK_DATA` flag.
*   **Real-time Debugging:** Use Smee.io to test webhook payloads locally via the Vite API middleware.

## 6. AI Assistant Preferences (Google Jules)
*   **Voice Input Confirmation:** If the input is a voice recording, print the command text to the chat interface before proceeding with the command.
*   **Creating Tasks:** Whenever the user asks to "Add a task in the github task project" or similar phrasing, it strictly means to *both* add the task to the project mentioned in the file `docs/PROJECT_INFO.md` *and* convert it into an issue.
*   **Jules Label:** Do not apply the `JULES` label to issues without explicit user confirmation.
*   **Jules Branches:** Always create Jules-specific branches under `/jules/`. Use `task#{number}` as the prefix if connected to an issue.

