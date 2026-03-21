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
