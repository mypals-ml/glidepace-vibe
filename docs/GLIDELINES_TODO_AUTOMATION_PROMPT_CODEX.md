# Glidelines Todo Automation Prompt

Open the Glidelines task board at `https://glidelines.vercel.app/?project=PVT_kwDODNQhvs4BWmqS&account=10445658`.

## Browser/Profile Requirement

- You MUST use the Google Chrome profile named `codex_auto` for all browser automation in this task.
  - To find its corresponding profile directory name (e.g., `Profile 1`, `Profile 2`), parse Chrome's `Local State` file (located at `~/Library/Application Support/Google/Chrome/Local State` on macOS) and look under `profile.info_cache` for the entry where the profile `name` matches `codex_auto`.
- Do NOT use the default Chrome profile, any personal profile, incognito profile, temporary profile, embedded browser, or in-app browser profile.
- Before doing any board work, verify that the active controlled browser session is the Google Chrome profile `codex_auto`.
  - Try to find and connect to an existing, remote debugging enabled Chrome browser first.
  - If no existing operatable Chrome browser is found, start Chrome in the foreground (with remote debugging enabled) using the identified `codex_auto` profile directory name.
- If the `codex_auto` profile is not available, terminate the entire job and report that blocker.
- If the Codex Chrome Extension is not installed and enabled in the `codex_auto` profile, terminate the entire job and report that blocker.
- If the `codex_auto` profile is not already logged into Glidelines/GitHub, terminate the entire job and report that blocker.
- Do not sign in, switch profiles, or continue in any fallback browser/profile.

## Task Workflow

- Find the first task whose state is `Todo`.
- If there is no task in state `Todo`, terminate the current automation task.
- Otherwise, change that task state to `In progress`.
- Add a comment: `CodeX Automation is working on it <current datetime>`.
- Open the task and read its title, description, and comments.

## Implementation Workflow

- Follow repository instructions in `AGENTS.md` and any referenced instruction files before editing code.
- Use the repository in the configured workspace to write an implementation and test plan.
- Review the plan for gaps, risks, edge cases, and missing verification.
- Execute the implementation.
- Run appropriate tests and required repository checks.

## Completion Workflow

- Commit the changes locally.
- Push the commit to remote `origin`.
- When the work is complete and tested, change the task state to `In review`.
- Add a comment in this format: `CodeX Automation committed the changes <current datetime> | <brief execution walkthrough>`.
- The walkthrough must briefly summarize what was implemented and how it was verified.
- Keep the full completion comment under 220 characters.

## Continuation

- Then continue to the next `Todo` task if time and context permit.
- Apply the same browser/profile checks before modifying any additional task.

## Reporting

- Report what task was handled.
- Report what changed.
- Report what tests/checks ran.
- Report any blockers.