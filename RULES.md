# Vibe Coding Rules

*   **Context First:** Always reference `ARCHITECTURE.md` and `TODO.md` before making sweeping changes.
*   **Strict Types:** All code must use strictly typed TypeScript to ensure the GitHub API data is properly modeled.
*   **Test-Supported:** Add unit tests for core logical algorithms (specifically the date cascading/math logic) before wiring them up to external UI or APIs.
*   **Incremental Flow:** Make small, verifiable changes. Commit frequently. Do not attempt to build the entire app at once.
