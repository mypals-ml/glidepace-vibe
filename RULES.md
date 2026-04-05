# Vibe Coding Rules

This document outlines the core principles and guidelines for developing within the Glidepace Vibe project.

## 1. Architecture & Design
*   **Context First:** Always reference `docs/ARCHITECTURE.md` before making sweeping changes.
*   **Separation of Concerns:** Keep files focused and split functions by features at best-efforts into different files. This promotes a clean architecture, enhanced readability, and easier maintainability.
*   **Code Reusability:** When implementing new features, always consider the reusability of components, functions, and utilities across the project to prevent duplication.

## 2. Coding Standards & Practices
*   **Strict Types:** All code must use strictly typed TypeScript to ensure data (such as GitHub API responses) is properly modeled and predictable.
*   **No Hardcoded Strings (i18n):** Avoid placing raw hardcoded text strings directly in the source UI code. Use the project's localization system (`i18n.ts`) for user-facing text.
*   **Accessibility (a11y):** Build interfaces that are always ready for disabled users. Practice semantic UI, keyboard navigation support, and correct ARIA labeling.

## 3. Development Workflow
*   **Incremental Flow:** Make small, verifiable changes. Commit frequently. Do not attempt to build the entire app at once.
*   **Test-Supported:** Add unit tests for core logical algorithms (specifically the date cascading/math logic) before wiring them up to external UI or APIs.
*   **Documentation Maintenance:** Whenever a new feature is added, modified, or removed, you must update `docs/FEATURES.md` to reflect the latest capabilities.

## 4. Version Control & Deployment
*   **Git Branch Flow Constraint:** We NEVER commit and push changes directly to the `release` branch. ALL modifications reaching `release` must originate from a Pull Request generated from the `develop` branch.
*   **Manual Review Required:** Any Pull Request seeking to merge into the `release` branch must be explicitly reviewed and approved by a human manually prior to merging.

## 5. Testing
*   **Mock Data via Environment Variables:** Mock data is defined in `src/lib/mockData.ts` and controlled by the `VITE_USE_MOCK_DATA` environment variable. Never hardcode `USE_MOCK_DATA = true` in source files.
*   **Test Mode:** Run `npm run dev:test` to start the dev server with mock data enabled. This loads `.env.test` (which sets `VITE_USE_MOCK_DATA=true`) via Vite's `--mode test` flag.
*   **Normal Mode:** Run `npm run dev` for normal development with real GitHub OAuth. `USE_MOCK_DATA` defaults to `false` when the env variable is absent.
*   **Test Documentation:** Save manual test plans and behavior descriptions in the `test/` directory using Markdown files (e.g., `test/SORT_DROPDOWN.md`).
*   **Adding Mock Data:** When new features require authenticated data for testing, add mock fixtures to `src/lib/mockData.ts` and gate them behind the `USE_MOCK_DATA` flag.

## 6. AI Assistant Preferences
*   **Voice Input Confirmation:** If the input is a voice recording, print the command text to the chat interface before proceeding with the command.
*   **Creating Tasks:** Whenever the user asks to "Add a task in the github task project" or similar phrasing, it strictly means to *both* add the task to the project mentioned in the file `docs/PROJECT_INFO.md` *and* convert it into an issue.
    *   **Google Jules**
        *   **Google Jules Label:** *DO NOT* add JULES label without user confirmation to any issue or task.
        *   **Google Jules Branches:** If Jules needs to create a branch, always create it under `/jules/`.
        *   **Google Jules Branch Naming:** If the branch has a connecting task or issue, the branch name should start with `task#{task/issue number}`.

