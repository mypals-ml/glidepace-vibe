# Vibe-Coding Best Practices: When to Start a New Conversation

When "vibe-coding" with Google Antigravity (or any advanced AI coding agent), knowing when to start a new conversation is crucial for maintaining focus, speed, and code quality. 

Here are the best practices on when you should hit the "New Conversation" button:

## 1. After Completing a Major Milestone
Treat conversations like focused Git branches or Jira tickets. Once you have successfully implemented, tested, and finalized a specific feature, bug fix, or refactor, start a new conversation for the next task.
* **Why:** This prevents the AI's context window from getting cluttered with the history of completed tasks, keeping it hyper-focused on the next objective.

## 2. When Shifting Context or Domains
If you are moving from building a React frontend UI to setting up a database schema or writing CI/CD pipelines, start a new thread.
* **Why:** The AI uses the conversation history to understand your current intent. Mixing completely different domains (e.g., CSS styling vs. SQL queries) in one thread can dilute its focus and lead to irrelevant suggestions.

## 3. If the AI Gets "Stuck" in a Loop
Sometimes an agent goes down a bad rabbit hole—repeatedly suggesting the same failing code, misinterpreting an error, or getting confused by a discarded approach you tried 10 messages ago.
* **Why:** The AI is heavily influenced by its own previous outputs in the chat history. Starting fresh with a clear prompt about the *current* state of the code and the *current* error cuts out the noise and breaks the bad loop immediately.

## 4. When the Conversation Gets Very Long
Even with massive context windows, the longer a conversation goes on, the more "context pollution" accumulates. You might notice the AI becoming slower to respond, starting to forget instructions you gave at the very beginning of the chat, or hallucinating outdated variable names.
* **Why:** Starting a new conversation gives the AI a clean slate to re-read your workspace as it exists right now, rather than relying on its memory of how files looked an hour ago.

## 5. When You Change Your Mind Radically
If you spend 20 minutes trying to build a feature using *Library A*, and then decide to completely rip it out and use *Library B* instead, start a new chat.
* **Why:** The AI will still have the context of *Library A* in its memory, which might cause it to accidentally mix syntax or concepts between the two libraries. A fresh chat ensures it only thinks about *Library B*.

---

### Pro-Tip for Starting a New Conversation:
When you start a fresh chat, give Antigravity a strong **anchoring prompt**. Tell it exactly where you are and what the immediate goal is. 

**Example transition prompt for a new chat:**
> *"I just finished implementing the GitHub OAuth backend. Everything is working. Now, I want to focus purely on the frontend UI for the login screen. Please review `src/components/Login.tsx` and let's add the new Stitch UI designs."*
