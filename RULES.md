# Vibe Coding Rules

*   **Context First:** Always reference `ARCHITECTURE.md` and `TODO.md` before making sweeping changes.
*   **Strict Types:** All code must use strictly typed TypeScript to ensure the GitHub API data is properly modeled.
*   **Test-Supported:** Add unit tests for core logical algorithms (specifically the date cascading/math logic) before wiring them up to external UI or APIs.
*   **Incremental Flow:** Make small, verifiable changes. Commit frequently. Do not attempt to build the entire app at once.
*   **Git Branch Flow Constraint:** We NEVER commit and push changes directly to the `release` branch. ALL modifications reaching `release` must originate from a Pull Request generated from the `develop` branch.
*   **Manual Review Required:** Any Pull Request seeking to merge into the `release` branch must be explicitly reviewed and approved by a human manually prior to merging.
