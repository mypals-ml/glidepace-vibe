# Task Plan: Optimize GitHub API Calling Rate

Date: 2026-06-13 09:06:15
Trigger: Runtime error reported in the web app —
`GitHub API Error: API rate limit already exceeded for user ID 10445658.`

Deliverable for this round: a plan document for review (this file). No
implementation is performed in this round.

## Goal

Stop the app from exhausting the GitHub GraphQL rate limit and make the limit
non-fatal when it is reached. Reduce the number of GitHub API requests the app
issues per user action, and add centralized rate-limit handling (backoff, retry,
queueing) so a depleted budget degrades gracefully instead of throwing a hard
error.

## Root Cause Summary

The error is GitHub's per-user rate limit (keyed on user ID). Every GitHub call
in the app funnels through a single wrapper, `fetchGitHubGraphQL` in
`src/lib/githubService.ts`. That wrapper performs a raw `fetch` with **no
rate-limit awareness**: it does not read `X-RateLimit-*` headers, does not
retry, has no backoff, no 403/429 handling, no request queue, and no caching.
When the budget is depleted, every subsequent call fails immediately with the
observed error.

There are 25 non-test call sites routing through this one wrapper. Three usage
patterns multiply request volume well beyond what each user action implies.

### Hotspot 1 — Write-then-refetch on every mutation (largest amplifier)

Nearly every mutation performs its write and then immediately re-reads the same
item via `fetchSingleProjectItem` (a second request), despite already applying
an optimistic local update.

| Action | File | Requests today |
| --- | --- | --- |
| Update status | `src/hooks/dashboardTasks/useTaskMutations.ts` (`updateTaskStatus`) | write + refetch = 2 |
| Update title | `src/hooks/dashboardTasks/useTaskCrud.ts` (`updateTaskTitle`) | write + refetch = 2 |
| Update description | `src/hooks/dashboardTasks/useTaskCrud.ts` (`updateTaskDescription`) | write + refetch = 2 |
| Update assignees | `src/hooks/dashboardTasks/useTaskMutations.ts` (`updateTaskAssignees`) | 1–2 writes + refetch = 2–3 |
| Update dates/estimate | `src/hooks/dashboardTasks/useTaskMutations.ts` (`updateTaskDates`) | one write **per field** (start, target, estimate, unit, autoUpdate) + refetch = up to 6 |
| Update successors | `src/hooks/dashboardTasks/useTaskMutations.ts` (`updateTaskSuccessors`) | source write + **one write per affected successor** + refetch |
| Add/update/delete comment | `src/hooks/dashboardTasks/useTaskComments.ts` | write + `fetchSingleProjectItem` + **re-page all comments** |

### Hotspot 2 — Per-item fan-out instead of batching

| Action | File | Pattern |
| --- | --- | --- |
| Reorder a block of tasks | `src/hooks/dashboardTasks/useTaskOrdering.ts` (`reorderTaskBlock`) | loops `updateProjectV2ItemPosition` one item at a time |
| Create a task | `src/hooks/dashboardTasks/useTaskCrud.ts` (`handleCreateTask`) | sequential chain of 6–9 requests: repo lookup → create issue → add to project → status → dates → assignees → group → position → final fetch |
| Move task to group | `src/hooks/dashboardTasks/useTaskOrdering.ts` (`moveTaskToGroupPath`) | per-field-change write + group path + position, sequentially |

### Hotspot 3 — Redundant / uncached reads

| Read | File | Issue |
| --- | --- | --- |
| Project list | `src/hooks/useDashboardProjects.ts` (`fetchProjects` → `GET_USER_PROJECTS_QUERY`) | re-runs on every project open/switch; no caching |
| Full project snapshot | `src/hooks/dashboardTasks/useTaskFetch.ts` (`fetchProjectTasks` → `GET_PROJECT_TASKS_QUERY`) | paginates 50-at-a-time over **both** fields and items; re-runs per open/switch; no caching |
| Assignee search | `src/hooks/dashboardTasks/useUserSearch.ts` (`fetchSearchUsers`) | up to 2–3 queries per picker open (repo assignable + org members + global search) |

Note: the webhook → Supabase Realtime sync layer
(`src/hooks/useDashboardSync.ts`, `src/lib/githubSyncEvents.ts`) is already
well-behaved — it has fingerprint dedupe, full-refresh coalescing, and per-item
in-flight guards. The problem is the GitHub-side cost per action, not the sync
triggering. This plan does not change the sync architecture.

## Plan (Prioritized Phases)

### Phase 1 — Make the rate limit non-fatal (highest impact, lowest risk)

Centralize all handling in `fetchGitHubGraphQL` (`src/lib/githubService.ts`) so
every one of the 25 call sites benefits without per-call-site changes.

1. Parse `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` from
   every response. Track remaining budget in a module-level state.
2. On HTTP 403/429 or a GraphQL `RATE_LIMITED` error, retry with exponential
   backoff that honors the reset timestamp / `Retry-After` rather than throwing.
   Cap the number of retries and total wait.
3. Add a lightweight request queue + concurrency limiter so bursts (block
   reorders, multi-field date saves, the create-task chain) serialize instead of
   firing in parallel and tripping the secondary limit.
4. When remaining budget is low, proactively pace requests (small inter-request
   delay) instead of waiting for a hard failure.
5. Replace the raw thrown error with a user-facing toast (e.g. "GitHub rate
   limit reached — retrying in Ns") wired through the existing `showToast`
   mechanism, and a non-fatal path that keeps the last known UI state.

Acceptance: when the budget is exhausted, the app waits and recovers
automatically; the user sees an informative message, not a hard error, and no
data is blanked.

### Phase 2 — Eliminate the write-then-refetch tax

Extend each mutation's GraphQL selection set to return the fields it changed, so
the follow-up `fetchSingleProjectItem` can be dropped. The optimistic local
update already exists, so for most mutations the refetch is pure overhead.

- Targets: `updateTaskStatus`, `updateTaskTitle`, `updateTaskDescription`,
  `updateTaskAssignees`, `updateTaskDates`, comment mutations.
- Keep a refetch only where the response genuinely cannot carry the derived
  state (e.g. dependency cascades that touch multiple items).

Expected effect: roughly halves the request count for the common edit actions.

### Phase 3 — Batch fan-out writes

Use GraphQL aliasing to combine multiple writes into a single request.

- `updateTaskDates`: collapse the per-field `updateProjectV2ItemField` calls
  into one aliased mutation.
- `reorderTaskBlock`: batch the per-item `updateProjectV2ItemPosition` calls.
- `handleCreateTask`: collapse the field-setup sequence (status/dates/assignees)
  where the API permits, reducing the 6–9 request chain to 1–2 where possible.

Expected effect: 5–9 requests per action collapse to 1–2.

### Phase 4 — Cache and dedupe reads

- Add short-TTL caching for `GET_USER_PROJECTS_QUERY` so project open/switch does
  not re-fetch the full list each time.
- Add an in-flight dedupe so identical concurrent queries share one request
  (e.g. assignee search firing while a previous one is in flight).
- Prefer single-item refresh over a full project re-page when only one item
  changed (already partially handled by the sync layer; apply the same
  preference to user-initiated refreshes where safe).

Expected effect: removes repeated full-list and full-snapshot reads from routine
navigation.

## Sequencing and Risk

- Phase 1 is the priority: it directly resolves the reported hard failure and is
  isolated to one file, so it carries the least risk.
- Phases 2–4 reduce how often the limit is reached at all and can land
  incrementally. Each is independently shippable.
- All phases preserve the existing optimistic-update and sync behavior; none
  change the webhook/Supabase architecture.

## Verification Plan

- Unit tests for the new `fetchGitHubGraphQL` behavior: header parsing, backoff
  scheduling, retry-on-429/403, queue serialization, and the non-fatal
  user-facing path (mock `fetch`).
- Regression: existing tests in `src/lib` and `src/hooks/dashboardTasks` must
  continue to pass.
- Manual smoke test against a real project: confirm an edit action issues the
  reduced request count (observe `[GitHubAPI]` console logs / network panel) and
  that an artificially low budget triggers backoff + toast rather than a hard
  error.

## Out of Scope

- Changing the dual OAuth-App / GitHub-App architecture.
- Changing the webhook → Supabase Realtime sync design.
- Server-side proxying or token pooling (could be a future phase if per-user
  limits remain a constraint after Phases 1–4).
