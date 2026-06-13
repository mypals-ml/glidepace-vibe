# Task Plan: Optimize GitHub API Calling Rate

Date: 2026-06-13 09:30:23
Supersedes: `plan/plan/plan-task#optimize-github-api-calling-rate-20260613182228.md`
(which superseded `...-20260613090615.md`)
Trigger: Runtime error reported in the web app —
`GitHub API Error: API rate limit already exceeded for user ID 10445658.`

Deliverable for this round: a consolidated, best-effort implementation plan only.
No implementation is performed in this round.

## What changed since the previous plan

This revision keeps the strong structure of the `182228` plan (per-token transport
limiter, strict service/UI layering, typed recoverable errors, primary-vs-secondary
classification, read-waste-before-write-refactor sequencing) and folds back in the
concrete evidence and acceptance detail from the `090615` plan. Net additions:

- A consolidated call-site inventory with exact per-action request counts and
  file/function references, so reviewers can see the "why" without re-reading the
  source.
- Explicit, measurable reduction targets per phase.
- A risk/rollback note per phase and a feature-flag/kill-switch for the new
  transport limiter.
- Pacing/jitter specifics and a small clarification on the foreground wait budget.

## Goal

Stop the app from exhausting the GitHub GraphQL budget during routine use, and
make rate-limit exhaustion non-destructive when it happens. The UI must keep the
last known usable state, surface a localized message, and either retry within a
bounded wait or fail with a recoverable typed error that lets the calling hook
preserve optimistic/stale state.

## Constraints and Design Requirements

- Multi-account: rate-limit state, concurrency state, and caches are keyed by
  account/token, never a single global budget. Account A must not throttle
  account B; switching accounts must not leak limiter or cache state.
- Mock-mode calls (`MOCK_TOKEN`, dummy project IDs `PVT_2`/`PVT_3`, `item-` IDs —
  see `fetchGitHubGraphQL`) must bypass real throttling and must not poison
  real-token limiter state.
- `src/lib/githubService.ts` stays a pure transport/service layer: no imports of
  dashboard UI code, `showToast`, React, or translation hooks.
- User-facing strings go through the existing i18n system (`react-i18next`), not
  hardcoded in the service layer.
- Foreground mutations must not hang indefinitely. If GitHub asks us to wait
  longer than the foreground retry budget, return a typed recoverable error so
  the calling hook keeps optimistic/stale state and shows a localized message.
- GitHub rate-limit behavior to account for:
  - GraphQL **primary** limit can return **HTTP 200 with `errors` and
    `x-ratelimit-remaining: 0`**.
  - **Secondary** limit can return HTTP 200 or 403 and may include `Retry-After`.
  - Mutative GraphQL requests should avoid concurrency and should be paced
    (~1s gap between mutations).
  - Continuing to retry while limited worsens enforcement.

Reference: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api

## Root Cause Summary

All real GitHub GraphQL calls funnel through `fetchGitHubGraphQL` in
`src/lib/githubService.ts` (25 non-test call sites). Today it performs a raw
`fetch` with **no rate-limit awareness**: no header parsing, no
primary/secondary classification, no retry policy, no per-account queue, no
pacing, and no request/cache dedupe. When the budget is depleted, every
subsequent call throws immediately with the observed error.

### Call-site inventory (non-test)

Reads:

| Read | File / function | Note |
| --- | --- | --- |
| Project list | `src/hooks/useDashboardProjects.ts` → `fetchProjects` (`GET_USER_PROJECTS_QUERY`) | re-runs on every open/switch; no cache |
| Full project snapshot | `src/hooks/dashboardTasks/useTaskFetch.ts` → `fetchProjectTasks` (`GET_PROJECT_TASKS_QUERY`) | paginates 50-at-a-time over **both** fields and items per loop iteration, even after one connection finished paging |
| Single item | `src/hooks/dashboardTasks/useTaskFetch.ts` → `fetchSingleProjectItem` (`GET_SINGLE_ITEM_QUERY`) | also invoked as the refetch tail of most mutations |
| Comments | `src/hooks/dashboardTasks/useTaskComments.ts` → `fetchTaskComments` (`GET_ISSUE_COMMENTS_QUERY`) | paginated; has an in-flight guard |
| Assignee search | `src/hooks/dashboardTasks/useUserSearch.ts` → `fetchSearchUsers` | up to 2–3 queries/open (assignable + org members + global) |
| Repository ID | `src/lib/githubService.ts` → `getRepositoryId` (`GET_REPOSITORY_ID_QUERY`) | per task creation; not cached |

Writes (each followed by a refetch unless noted):

| Action | File / function | Requests today |
| --- | --- | --- |
| Status | `useTaskMutations.ts` → `updateTaskStatus` | write + refetch = 2 |
| Title | `useTaskCrud.ts` → `updateTaskTitle` | write + refetch = 2 |
| Description | `useTaskCrud.ts` → `updateTaskDescription` | write + refetch = 2 |
| Assignees | `useTaskMutations.ts` → `updateTaskAssignees` | 1–2 writes (mutation returns nodes) + refetch = 2–3 |
| Dates/estimate | `useTaskMutations.ts` → `updateTaskDates` | **one write per field** (start, target, estimate, unit, autoUpdate) + refetch = up to 6 |
| Successors | `useTaskMutations.ts` → `updateTaskSuccessors` | source write + **one write per affected successor** + refetch |
| Reorder block | `useTaskOrdering.ts` → `reorderTaskBlock` | **one `updateProjectV2ItemPosition` per item**, sequential |
| Move to group | `useTaskOrdering.ts` → `moveTaskToGroupPath` | per-field write + group path + position, sequential |
| Create task | `useTaskCrud.ts` → `handleCreateTask` | sequential chain of 6–9: repo lookup → create issue → add to project → status → dates → assignees → group → position → final fetch |
| Comment add/update/delete | `useTaskComments.ts` | write + `fetchSingleProjectItem` + **full comment re-page** |

The webhook → Supabase Realtime sync (`useDashboardSync.ts`, `githubSyncEvents.ts`)
is already well-behaved (fingerprint dedupe, full-refresh coalescing, per-item
in-flight guard). This plan does not change the sync or dual-app architecture.

## Phase 1: Token-Scoped Rate-Limit Transport

Centralize handling in `src/lib/githubService.ts`; keep all state per token/account.

1. Add typed transport primitives (exported from the service):
   - `GitHubRateLimitError` (primary)
   - `GitHubSecondaryRateLimitError`
   - `GitHubRequestFailedError`
   - optional `RateLimitState` export for diagnostics/tests
2. Parse response headers on every real request: `x-ratelimit-limit`,
   `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset`,
   `retry-after`.
3. Classify both HTTP and GraphQL-body failures:
   - HTTP 403/429 with rate-limit text or zero remaining
   - **HTTP 200 with `errors` and zero remaining** (primary)
   - HTTP 200/403 secondary-limit errors
4. Maintain a per-token limiter, keyed by a stable account/token key (never log
   raw token values — the existing code logs only `token.slice(-4)`; keep that):
   - queue requests per key
   - allow limited read concurrency when safe
   - serialize/strictly pace mutative requests, keeping ≥1s between mutations
   - add small jitter to avoid synchronized retries
5. Bounded retry behavior:
   - honor `Retry-After` first
   - if remaining is zero, honor `x-ratelimit-reset`
   - for secondary limits with no reset, wait ≥1 minute only when the caller
     allows background/deferred waiting
   - cap foreground retries by total wait (target ~20–30s) then return a typed
     recoverable error
   - cap background retries separately (reset + jitter), and always abort on the
     caller's `AbortSignal`
6. Add an optional `FetchGitHubGraphQLOptions` parameter:
   - `operationType: 'query' | 'mutation'`
   - `priority?: 'foreground' | 'background'`
   - `maxWaitMs?: number`
   - `signal?: AbortSignal`
   - `dedupeKey?: string`
7. Backward compatibility: default existing calls to safe behavior, then annotate
   high-volume call sites incrementally.
8. Ship behind a runtime kill-switch (env flag or constant) so the new limiter
   can be disabled to fall back to the current raw-fetch path if a regression
   appears.

Acceptance:
- Mock requests return immediately and never touch real-token limiter state.
- Account A throttling does not affect account B.
- Exhausted primary limit does not blank the dashboard.
- Secondary limit does not spin retries.
- Foreground operations fail with a typed recoverable error after the wait budget.
- Tests cover header parsing, HTTP 403/429, HTTP 200 GraphQL rate-limit errors,
  queue ordering, per-token isolation, mock bypass, abort, and kill-switch.

Risk/rollback: highest-leverage, isolated to one file; kill-switch reverts.

## Phase 2: UI Error Handling and Localization

Keep UI messaging out of `githubService.ts`.

1. Add shared helpers in the dashboard hooks to detect the typed rate-limit errors.
2. Add localized strings (i18n) for: retrying soon; limit reached / showing last
   known state; operation deferred or failed because GitHub asked us to wait too
   long.
3. Update initial load, background refresh, and mutation hooks to handle typed
   rate-limit errors distinctly from ordinary API failures (today
   `useDashboardProjects` only special-cases `401`, and `useTaskFetch` shows a
   generic background-refresh toast).
4. Preserve optimistic UI where safe; roll back only when the operation genuinely
   failed, not when it was queued/deferred.

Acceptance: no hardcoded rate-limit UI strings; service has no React/toast
dependency; background-refresh failures keep existing tasks on screen; mutation
failure paths are explicit and testable.

## Phase 3: Reduce Read Waste (before broad mutation refactors)

Lowers request cost without touching many write paths (lower risk first).

1. Gate full-snapshot pagination so it stops requesting `fields` after fields are
   fully paged and stops requesting `items` after items are fully paged (today
   both connections are requested every iteration). Consider splitting into
   `GET_PROJECT_FIELDS_QUERY` / `GET_PROJECT_ITEMS_QUERY` if it simplifies code.
2. Cache project fields per project/account with explicit invalidation.
3. Add short-TTL cache + in-flight dedupe for `GET_USER_PROJECTS_QUERY`, keyed by
   account.
4. Add in-flight dedupe for identical single-item fetches and assignee searches.
5. Cache repository ID by `owner/repo/account` (used by `handleCreateTask`).
6. Keep the existing comment in-flight guard; avoid full comment re-page after
   add/update/delete when the mutation response carries enough data.

Targets: project open/switch issues 0 redundant project-list requests within TTL;
full-snapshot pagination never re-requests a completed connection.

Risk/rollback: caches are additive; a TTL of 0 / disabled dedupe restores current
behavior.

## Phase 4: Remove Write-Then-Refetch Safely

Drop the `fetchSingleProjectItem` tail **only after** relocating the side effects
currently hidden inside it.

1. Extract reusable post-fetch side effects from `useTaskFetch` /
   `fetchSingleProjectItem`:
   - dependency field correction persistence (`persistDependencyFieldCorrections`)
   - auto-sync for missing done-task estimate values
   - `updateSyncTime` timestamp update
2. Per mutation, decide whether optimistic local data + mutation response is
   authoritative:
   - status: likely safe to drop refetch
   - title/body: safe if mutation returns updated node fields, else accept
     optimistic state
   - assignees: issue assignees already return nodes (safe); draft assignees need
     response expansion or a narrow refresh
   - dates/estimates: safe only after the dependency-correction side effects are
     preserved
   - comments: use mutation response/local state instead of item refresh + full
     comment re-page
   - dependencies/successors: keep a targeted refresh where multiple related
     items may change outside local certainty
3. Remove refetches incrementally, one mutation family at a time, each behind its
   own small change so regressions are easy to bisect.

Target: common edit actions (status/title/body/assignee) drop from 2–3 requests
to 1. Dependency repair behavior unchanged; optimistic state + webhook
reconciliation still converge to GitHub.

## Phase 5: Batch Fan-Out Writes Where GitHub Permits

Aliasing reduces HTTP calls but not mutation cost; secondary-limit pacing still
applies.

1. Add typed helper(s) for aliased project-item field mutations.
2. Batch independent field updates for one item: `updateTaskDates`, and
   group-field changes where multiple fields change together.
3. Batch position updates only when order is proven safe: `reorderTaskBlock`
   currently uses each previous move's item as the next `afterId` — verify
   aliased position mutations execute in the required order before replacing the
   loop; otherwise leave sequential.
4. Do not assume `handleCreateTask` collapses to one request: `createIssue` must
   complete before `addProjectV2ItemById` can use the new issue ID. Cache the
   repository lookup (Phase 3) and batch only the post-create field setup. Draft
   issues already create the project item directly.
5. Update `src/lib/githubMock.ts` to parse the aliased mutation shapes used by
   tests.

Target: batched date save = 1 request where fields exist; create-task avoids
repeated repo lookups and batches post-create field setup.

## Phase 6: Instrumentation and Verification

1. Structured debug logging around real calls (extend the existing `[GitHubAPI]`
   logs): account key, operation name, operation type, cost headers where
   available, remaining budget, wait duration, retry count — never full tokens.
2. Manual/local test notes in `test/` for: normal edit actions; exhausted primary
   budget; secondary-limit; account switching; project open/switch.
3. Required verification gates for any implementation PR:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
   - focused Vitest for new transport/cache/batching behavior
   (Node/npm at `/opt/homebrew/opt/node@22/bin` per `ANTIGRAVITY.md`.)

Acceptance: before/after request counts comparable via `[GitHubAPI]` logs or the
network panel; account switching leaks no limiter/cache state; long reset windows
keep the UI usable instead of hanging foreground actions.

## Test Plan

Runner: Vitest (`npm run test` → `vitest run`), jsdom environment, globals
enabled (`vite.config.ts`). New unit tests live next to their source as
`*.test.ts`. Real `fetch` is mocked with `vi.fn()` / `vi.stubGlobal('fetch', ...)`;
timers are controlled with `vi.useFakeTimers()` so backoff waits don't slow the
suite. No test makes a real network call.

### Phase 1 — `src/lib/githubService.test.ts` (transport limiter)

Header parsing
- parses `x-ratelimit-remaining`, `-limit`, `-used`, `-reset`, `retry-after` into
  per-token `RateLimitState`.
- missing/garbage headers fall back to safe defaults and never throw.

Failure classification
- HTTP 403 with rate-limit body → `GitHubSecondaryRateLimitError`.
- HTTP 429 → secondary error path.
- HTTP 200 with `errors` and `x-ratelimit-remaining: 0` → `GitHubRateLimitError`
  (primary).
- HTTP 200 with ordinary `errors` and remaining > 0 → returns data, not classified
  as rate limit.
- non-rate-limit HTTP 5xx/4xx → `GitHubRequestFailedError`.

Retry / backoff (fake timers)
- honors `Retry-After` before `x-ratelimit-reset`.
- primary exhaustion waits until reset, then succeeds on retry.
- secondary limit does not busy-retry; waits ≥ configured minimum.
- foreground priority returns a typed recoverable error once `maxWaitMs` is
  exceeded (no indefinite hang).
- background priority waits longer (reset + jitter) and still aborts on
  `AbortSignal`.
- retry count is bounded (asserts max attempts).

Per-token isolation & queueing
- account A at zero remaining does not delay account B requests.
- mutations for one token serialize with ≥ ~1s pacing; queue preserves order.
- reads may run with limited concurrency.

Mock bypass & kill-switch
- `MOCK_TOKEN` / dummy project IDs (`PVT_2`, `PVT_3`) / `item-` IDs bypass the
  limiter entirely and never mutate real-token state.
- kill-switch disabled → behavior is the legacy raw-fetch path.

Abort
- aborting the `AbortSignal` mid-wait rejects promptly with an abort error and
  releases the queue slot.

### Phase 2 — UI error handling (hook tests + helpers)

- `isGitHubRateLimitError` / detection helper returns true only for the typed
  errors, false for generic `Error`.
- `useDashboardProjects` / `useTaskFetch`: a typed primary-limit error during
  background refresh keeps existing tasks (no blanking) and selects the localized
  "showing last known state" message, distinct from the generic failure toast and
  from the existing `401` path.
- a deferred/queued operation does NOT roll back optimistic state; only a genuine
  failure rolls back.
- assert i18n keys exist in the locale files (no hardcoded strings); the service
  module has no import of React/`showToast`/i18n (guarded by an import-surface
  test or lint rule).

### Phase 3 — read-waste reduction

- pagination gate: once `fields.pageInfo.hasNextPage` is false, subsequent loop
  iterations omit the `fields` connection from variables; same for `items`
  (assert on captured request variables via the fetch mock).
- `GET_USER_PROJECTS_QUERY` short-TTL cache: two calls within TTL → one network
  request; after TTL → two; cache keyed by account (different account → separate
  request).
- in-flight dedupe: two concurrent identical single-item fetches / assignee
  searches share one promise (fetch called once).
- repository-ID cache keyed by `owner/repo/account`; second create reuses it.
- invalidation: a project mutation invalidates the affected project/account cache
  entry.

### Phase 4 — write-then-refetch removal

- extracted side-effect helper (dependency-correction persistence, done-task
  estimate auto-sync, sync-time update) runs independently of
  `fetchSingleProjectItem`.
- status / title / body / issue-assignee mutations issue exactly one request
  (write) and update local state from optimistic data + mutation response (assert
  via fetch-mock call count).
- draft-assignee and dependency/successor paths retain their narrow refresh.
- comment add/update/delete update local state from the mutation response without
  a full comment re-page.
- convergence: after dropping the refetch, a following webhook/single-item
  reconcile still yields GitHub-authoritative state (uses existing
  `taskReconciliation` tests as the safety net).

### Phase 5 — batching (also requires `githubMock.ts` updates)

- `githubMock.ts` parses aliased project-item field mutations and aliased position
  mutations; add focused cases to `githubMock.test.ts`.
- `updateTaskDates` with multiple changed fields issues one aliased mutation
  (assert single request, all fields present).
- `reorderTaskBlock`: assert order is preserved; if aliasing can't guarantee order
  it stays sequential (test documents the chosen behavior).
- `handleCreateTask`: repository lookup is cached (Phase 3) and post-create field
  setup is batched; issue-creation still precedes add-to-project (ordering
  asserted).

### Phase 6 — instrumentation & regression gates

- structured log entries include account key, operation type, remaining budget,
  wait/retry counts, and never the full token (assert redaction).
- full regression: existing suites in `src/lib` and `src/hooks/dashboardTasks`
  continue to pass.
- CI gates run clean: `npm run lint`, `npm run type-check`, `npm run build`,
  `npm run test`.
- manual smoke notes captured in `test/` per Phase 6.

### Coverage expectations

- New transport, cache, and batching code paths covered by focused unit tests.
- Every new typed error class exercised in at least one classification test and
  one hook-handling test.
- No regression in existing `*.test.ts` counts; new tests added, none removed.

## Suggested Implementation Order

1. Phase 1 transport limiter (+ kill-switch) with tests.
2. Phase 2 typed UI handling and localization.
3. Phase 3 read-waste reduction.
4. Phase 4 remove refetches, mutation family by family.
5. Phase 5 batching, starting with date/field writes.
6. Phase 6 instrumentation/manual-test docs — start in Phase 1, continue throughout.

## Expected Cumulative Effect

- Phase 1 alone converts the reported hard failure into a bounded, recoverable
  wait.
- Phases 3–5 reduce steady-state request volume: common edits ~2–3 → 1, date
  saves up to 6 → 1, project navigation sheds redundant list/snapshot reads.

## Implementation Status (2026-06-13)

All six phases implemented on top of the analysis above. Verification gates:
`npm run lint`, `npm run type-check`, `npm run build`, `npm run test` all pass
(268 tests, 29 files; build succeeds — the only build error in the sandbox was a
host-permission issue deleting `dist/`, not a code error).

| Phase | Status | Key files |
| --- | --- | --- |
| 1 — Token-scoped transport | Done | `src/lib/githubRateLimiter.ts` (new: typed errors, header parsing, primary/secondary classification, per-token queue + pacing, bounded foreground/background retry w/ AbortSignal), `src/lib/githubService.ts` (wraps `fetchGitHubGraphQL`, `FetchGitHubGraphQLOptions`, mock bypass, `VITE_GITHUB_RATE_LIMITER` kill-switch). Tests: `githubRateLimiter.test.ts`, `githubService.test.ts` |
| 2 — UI error handling + i18n | Done | `isGitHubRateLimitError` consumed in `useTaskFetch.ts` (background keeps tasks, distinct message) and `useDashboardProjects.ts`; locale keys `rateLimitRetrying`/`rateLimitShowingStale`/`rateLimitDeferred` in all 4 locales; service stays UI-free (guarded). Tests: `githubServiceErrors.test.ts` |
| 3 — Read waste | Done | `@skip(if:)` pagination gate in `githubQueries.ts` + `useTaskFetch.ts`; `src/lib/githubReadCache.ts` (new: TTL + in-flight dedupe) applied to project list (`useDashboardProjects.ts`) and repo ID (`githubService.ts`); `dedupeKey` for single-item + assignee searches. Tests: `githubReadCache.test.ts` |
| 4 — Remove write-then-refetch | Done | Dropped `fetchSingleProjectItem` tails for status/title/body/issue-assignee/comments (optimistic state authoritative); kept narrow refresh for draft assignees + dependency cascades. `useTaskMutations.ts`, `useTaskCrud.ts`, `useTaskComments.ts` |
| 5 — Batch fan-out writes | Done | `batchUpdateProjectV2ItemFields` aliased mutation in `githubService.ts`; `updateTaskDates` now one request; mock parses aliased shape (`githubMock.ts`). Reorder/create left sequential (ordering dependencies, as planned; create benefits from repo-ID cache). Tests in `githubService.test.ts` + `githubMock.test.ts` |
| 6 — Instrumentation + verification | Done | Structured token-safe `[GitHubAPI]` logging in the retry loop; manual smoke notes at `test/GITHUB_RATE_LIMIT_OPTIMIZATION_MANUAL.md`; all gates pass |

Kill-switch: set `VITE_GITHUB_RATE_LIMITER=off` to revert to the legacy raw-fetch
transport if a regression appears.

## Out of Scope

- Replacing the OAuth user-token model with a server-side proxy.
- Token pooling.
- Changing the webhook → Supabase Realtime architecture.
- Changing the dual OAuth-App / GitHub-App architecture.
- Increasing GitHub quota via organization/Enterprise configuration.
