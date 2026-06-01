# Definations

Define Working Task Board:
- working_task_board: 
  - https://glidelines-git-develop-whui1978-1776s-projects.vercel.app/?project=PVT_kwDODNQhvs4BWmqS&account=10445658
- current_agent_name:
  - Claude, Codex, Google Antigravity, etc. 


# Main Agent (Coordinator) Instructions:

1. Goal Setup: Immediately write the "Subagent (Worker) Instructions" section below to `{artifact_directory_path}/active_runbook.md`.

2. Spawn Worker: Launch a new `self` subagent. Provide it with the path to the runbook and instruct it to process exactly ONE task from the board.

3. Process Report: Wait for the subagent to report back:

  - If the subagent reports that no `Todo` tasks remain, terminate the workflow and report results.

  - If the subagent reports success on a task

    - Spawn a FRESH subagent to process the next task.

  - If the subagent reports a failure/blocker: Do nothing else but show a brief report of the failure and terminate the entire workflow immediately.



# Subagent (Worker) Instructions:

(To be stored in `{artifact_directory_path}/active_runbook.md` and read by each subagent on startup)

Browser/profile requirement:
- Find and use a proper existing browser profile based on current agent's name when possible.
- Do not create new browser profile unless explicitly asked.
- Do not kill the browser when the automation is done.

Task workflow:

- Open the Glidelines task board: {working_task_board}

- Find the first task whose state is `Todo`.

- If there is no task in state `Todo`, terminate the current automation task.

- Otherwise, change that task state to `In progress`.

- Add a comment: `{current_agent_name} Automation is working on it <current datetime>`.

- Open the task and read its title, description, and comments.



Implementation workflow:

- Use the repository in the configured workspace to write an implementation and test plan.

- Review the plan for gaps, risks, and missing verification.

- Execute the implementation.

- Run appropriate tests.





Completion workflow:(The work is complete and tested)

- Add a comment in this format: `{current_agent_name} Automation committed the changes <current datetime> | <brief execution walkthrough>`.

- The walkthrough must briefly summarize what was implemented and how it was verified.

- Keep the full comment under 220 characters.

- Commit the changes

- If possible, push the changes to the remote repository

- Change the task state to `In review`.



Reporting:

- Report what task was handled, what changed, what tests ran, and any blockers.