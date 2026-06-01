[@chrome]

## Objective
Automate the Glidelines task board workflow using the Chrome browser and its extension client.

## Setup
1. Navigate to: `https://glidelines.vercel.app/?project=PVT_kwDODNQhvs4BWmqS&account=10445658`
2. Do not kill chrome, just make the window visible

## Task Workflow (repeat until no more Todo tasks or time/context limit reached)
1. Find the **first** task card whose state is `Todo`.
2. If no `Todo` tasks exist, terminate the automation and report completion.
3. Change that task’s state to `In progress`.
4. Add a comment: `CodeX Automation is working on it <current datetime in Asia/Tokyo>`.
5. Open the task and read its title, description, and all comments.

## Implementation Workflow
- Follow the repository instructions in `AGENTS.md` and any files it references (especially `ANTIGRAVITY.md`) **before** editing any code.
- In the workspace, create a clear implementation + test plan for the task.
- Review the plan for gaps, risks, edge cases, and missing verification steps.
- Implement the changes.
- Run relevant tests and all required repository checks (lint, type-check, build, etc.).

## Completion Workflow
1. Commit the changes locally.
2. Push the commit to remote `origin`.
3. Change the task state to `In review`.
4. Add a comment in this exact format (must be ≤ 220 characters):
   `CodeX Automation committed the changes <current datetime> | <brief execution walkthrough>`
   - The walkthrough must concisely summarize what was implemented and how it was verified.

## Continuation & Guardrails
- After finishing one task, immediately check for the next `Todo` task.
- Apply the same Chrome extension connectivity check before starting work on any additional task.
- Maximum 3 tasks per automation run (to avoid runaway loops).
- If any step fails (connectivity, UI interaction, tests, push, etc.), stop, report the failure, and do not continue to the next task.

## Reporting (at the end of the run)
- Which task(s) were handled.
- What code changes were made.
- What tests/checks were executed and their results.
- Any blockers or failures encountered.
