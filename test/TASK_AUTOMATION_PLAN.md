# Task Automation Implementation & Test Plan - May 28, 2026

This document outlines the implementation and test plan for the Glidelines task board automation.

## 1. Browser Profile & Environment Requirements
- **Chrome Profile**: Must use the custom profile named `agy` located at `/Users/wanghui/.gemini/antigravity-browser-profile` under `Profile 2`.
- **Codex Extension**: Must ensure the Codex extension (ID: `hehggadaopoacecdllhhajmbjkdcmajg`) is active.
- **Chrome Launch Settings**:
  - Headful/foreground mode (`headless: false`).
  - Bypass default extension restrictions (`ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages']`).
  - Safe shutdown: Always close cleanly via Puppeteer API (`await browser.close()`). Do not kill via command line process signals.
  - Re-use the existing browser debugging session on port 9222 where possible.
- **Focus Management**:
  - Query frontmost application process name using AppleScript before launch.
  - Activate/restore focus to the captured frontmost application immediately after launching.

## 2. Automation Workflow & Logic
- **Board URL**: Navigate to `https://glidelines.vercel.app/?project=PVT_kwDODNQhvs4BWmqS&account=10445658`.
- **Todo Task Identification**:
  - Parse task elements matching `[data-task-id]`.
  - Check inner text or `group/status` elements for status value matching `Todo`.
- **Branching Decision**:
  - **Case A: No Todo Task exists**
    - Log completion status.
    - Terminate automation task cleanly.
  - **Case B: Todo Task found**
    - Select the first Todo task.
    - Click task card to open the sidebar.
    - Transition status in sidebar to `In progress`.
    - Post a start comment: `Google Antigravity Automation is working on it <current datetime>`.
    - Extract and read the task details (title, description, and comments).
    - Implement the required changes for the task in the codebase.
    - Verify implementation using `npm run lint`, `npm run type-check`, and `npm run test` (or task-specific tests).
    - Commit changes with commit message containing task ID.
    - Push changes to the repository `develop` branch.
    - Post completion comment in sidebar: `Google Antigravity Automation committed the changes <current datetime> | <brief walkthrough>`.
    - Transition status in sidebar to `In review`.
    - Continue to the next `Todo` task if available.

## 3. Test & Verification Plan
- **Verification of Profile**: Run `/opt/homebrew/opt/node@22/bin/node scripts/verify_agy_profile.js` to assert the folder and preferences contain `agy` as the profile name.
- **Verification of Extension Target**: Run `/opt/homebrew/opt/node@22/bin/node scripts/test_extension_target.js` to ensure the Codex background target resolves to `active: true` when page is loaded.
- **Execution of Claim Script**: Run `claim_todo_task.js` to run the task identification and claiming phase.
- **Verification of Changes**: Perform manual and automated checks of the claimed task before submitting.

## 4. Execution Logs
### May 28, 2026
- Verified profile name matches 'agy' in local state and preferences.
- Verified Codex extension target (ID: hehggadaopoacecdllhhajmbjkdcmajg) is active.
- Board URL checked: https://glidelines.vercel.app/?project=PVT_kwDODNQhvs4BWmqS&account=10445658
- Total tasks found: 54
- Tasks in state `Todo`: 0
- Action: Terminated the automation task cleanly as there are no tasks in state `Todo`.
