# Google Antigravity AI Agent Instructions

This file contains specific instructions and protocols for the Google Antigravity AI agent working on the Glidelines project.

## Core Protocols

1.  **Read and Follow RULES.md**: Always adhere to the general development rules defined in [RULES.md](RULES.md).
2.  **Voice Input Confirmation**: If the user provides input via a voice recording, print the transcribed command text to the chat interface before proceeding with the command.
3.  **Task Creation**: When the user asks to "Add a task in the github task project" (or similar), strictly perform *both*:
    - Add the task to the project specified in `docs/PROJECT_INFO.md`.
    - Convert that project item into a GitHub Issue.

## Project Specific Guidance

### Mock Data System

Mock mode is essential for UI development and testing without a live GitHub connection. It activates when:
- `VITE_USE_MOCK_DATA=true` (set in `.env.test`).
- Auth token equals `mock-token`.
- Project ID is `PVT_2` or `PVT_3`.
- Item IDs start with `item-`.

Key files:
- `src/lib/githubMock.ts`: Comprehensive GraphQL handler.
- `src/lib/mockData.ts`: Central location for mock fixtures.

Use `npm run dev:test` to start the development server in mock mode.

### Command Environment

The `PATH` on this machine may be restricted. Node.js and npm are located at `/opt/homebrew/opt/node@22/bin`. If commands fail, manually update the `PATH` in your terminal session:
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

## Documentation Reference

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Local Development Guide](docs/LOCAL_DEVELOPMENT.md)
- [Feature Specifications](docs/FEATURES.md)
