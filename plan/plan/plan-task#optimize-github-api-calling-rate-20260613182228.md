# Task Plan: Optimize GitHub API Calling Rate

Date: 2026-06-13 18:22:28
Supersedes: `plan/plan/plan-task#optimize-github-api-calling-rate-20260613090615.md`
Trigger: Runtime error reported in the web app —
`GitHub API Error: API rate limit already exceeded for user ID 10445658.`

Deliverable for this round: revised implementation plan only. No implementation is
performed in this round.

## Goal

Stop the app from exhausting the GitHub GraphQL budget during routine use, and
make rate-limit exhaustion non-destructive when it happens. The UI should keep
the last known usable state, surface a localized message, and either retry within
a bounded wait or fail with a recoverable typed error.

## Constraints and Design Requirements

- The app supports multiple connected GitHub accounts. Rate-limit state,
  concurrency state, and caches must be keyed by account/token, not held as one
  global budget.
- Mock-mode calls must continue to bypass real GitHub throttling and must not
  poison real-token limiter state.
- `src/lib/githubService.ts` should stay a transport/service layer. It should
  not import dashboard UI code, `showToast`, or translation hooks.
- User-facing strings must go through the existing i18n system, not hardcoded in
  the service layer.
- Foreground mutations must not hang indefinitely. If GitHub asks us to wait
  longer than the foreground retry budget, return a typed recoverable error so
  the calling hook can keep optimistic/stale state and show a localized message.
- GitHub guidance to account for:
  - GraphQL primary limit can return HTTP 200 with errors and
    `x-ratelimit-remaining: 0`.
  - Secondary limit can return HTTP 200 or 403 and may include `Retry-After`.
  - Mutative GraphQL requests should avoid concurrency and should be paced.
  - Continuing to retry while limited can worsen enforcement.

Reference: GitHub GraphQL API rate-limit documentation:
https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api

## Root Cause Summary

All real GitHub GraphQL calls funnel through `fetchGitHubGraphQL` in
`src/lib/githubService.ts`. Today it performs a raw `fetch` with no
rate-limit awareness: no header parsing, no primary/secondary limit
classification, no retry policy, no per-account queue, no pacing, and no
request/cache dedupe.

The highest-volume app patterns are:

- Write-then-refetch: common mutations write successfully, then call
  `fetchSingleProjectItem`.
- Per-item fan-out: block reorders, date saves, dependency updates, group moves,
  and task creation issue several sequential mutations.
- Redundant reads: project list fetches, full project snapshots, assignee
  search, and comment refreshes repeat data that is already known or in flight.
- Full snapshot pagination currently asks for both project fields and project
  items in each loop iteration, even after one connection has finished paging.

## Phase 1: Token-Scoped Rate-Limit Transport

Implement centralized rate-limit handling in `src/lib/githubService.ts`, but make
the state per token/account.

1. Add typed transport primitives:
   - `GitHubRateLimitError`
   - `GitHubSecondaryRateLimitError`
   - `GitHubRequestFailedError`
   - optional `RateLimitState` export for diagnostics/tests
2. Parse response headers on every real request:
   - `x-ratelimit-limit`
   - `x-ratelimit-remaining`
   - `x-ratelimit-used`
   - `x-ratelimit-reset`
   - `retry-after`
3. Classify both HTTP and GraphQL-body failures:
   - HTTP 403/429 with rate-limit text or zero remaining
   - HTTP 200 with `errors` and zero remaining
   - HTTP 200/403 secondary-limit errors
4. Maintain a per-token limiter:
   - key by a stable token/account key; avoid logging raw token values
   - queue requests per key
   - allow limited read concurrency if safe
   - serialize or strictly pace mutative requests
   - keep at least a one-second gap between mutative requests when possible
5. Add bounded retry behavior:
   - honor `Retry-After` first
   - if remaining is zero, honor `x-ratelimit-reset`
   - for secondary limits with no reset, wait at least one minute only when the
     caller allows background/deferred waiting
   - cap foreground retries by total wait, e.g. 20-30 seconds
   - cap background retries separately, e.g. reset time plus jitter, but always
     abort if the caller's `AbortSignal` is cancelled
6. Add an optional `FetchGitHubGraphQLOptions` parameter:
   - `operationType: 'query' | 'mutation'`
   - `priority?: 'foreground' | 'background'`
   - `maxWaitMs?: number`
   - `signal?: AbortSignal`
   - `dedupeKey?: string`
7. Preserve compatibility by defaulting existing calls to safe behavior, then
   gradually annotate high-volume call sites with operation type and priority.

Acceptance:

- Mock requests still return immediately.
- Requests for account A do not throttle account B.
- Exhausted primary limit does not blank the dashboard.
- Secondary limit does not spin retries.
- Foreground operations fail with a typed recoverable error after the configured
  wait budget.
- Tests cover headers, HTTP 403/429, HTTP 200 GraphQL rate-limit errors, queue
  ordering, per-token isolation, mock bypass, and abort behavior.

## Phase 2: UI Error Handling and Localization

Keep UI messaging outside `githubService.ts`.

1. Add shared helpers in dashboard hooks to detect typed rate-limit errors.
2. Add localized strings for:
   - retrying soon
   - GitHub limit reached, showing last known state
   - operation deferred or failed because GitHub asked us to wait too long
3. Update initial load, background refresh, and mutation hooks to handle typed
   rate-limit errors distinctly from ordinary API failures.
4. Preserve optimistic UI where safe; rollback only when the operation genuinely
   failed, not when it is queued/deferred.

Acceptance:

- No hardcoded rate-limit UI strings are introduced.
- API service has no React/toast dependency.
- Background refresh failures keep existing tasks on screen.
- Mutation failure paths are explicit and testable.

## Phase 3: Reduce Read Waste Before Broad Mutation Refactors

This phase lowers request cost without changing many write paths.

1. Split or conditionally gate full project snapshot pagination:
   - stop requesting `fields` after fields are fully paged
   - stop requesting `items` after items are fully paged
   - consider separate `GET_PROJECT_FIELDS_QUERY` and
     `GET_PROJECT_ITEMS_QUERY` if it keeps the code simpler
2. Cache project fields per project/account with explicit invalidation.
3. Add short-TTL cache and in-flight dedupe for `GET_USER_PROJECTS_QUERY`,
   keyed by account.
4. Add in-flight dedupe for identical single-item fetches and assignee searches.
5. Keep existing comment-level in-flight guard, but avoid re-paging all comments
   after add/update/delete when the mutation response contains enough data to
   update local state.

Acceptance:

- Opening/switching projects avoids repeated project-list requests within the TTL.
- Full snapshot pagination no longer asks GitHub for a completed connection.
- Concurrent identical reads share one promise.
- Cache invalidation is scoped by account and project.

## Phase 4: Remove Write-Then-Refetch Safely

Drop `fetchSingleProjectItem` follow-ups only after moving side effects currently
hidden in `fetchSingleProjectItem`.

1. Extract reusable post-fetch side effects from `useTaskFetch`:
   - dependency field correction persistence
   - auto-sync for missing done-task estimate values
   - sync timestamp update
2. For each mutation, document whether local optimistic data plus mutation
   response is authoritative enough:
   - status: likely safe to avoid refetch
   - title/body: safe if mutation returns updated node fields or optimistic
     state is accepted
   - assignees: safe for issue assignees because mutation already returns nodes;
     draft assignees need response expansion or a narrow refresh
   - dates/estimates: safe only after dependency correction side effects are
     preserved
   - comments: use mutation response/local state instead of item refresh plus
     full comment re-page
   - dependencies: keep targeted refresh only where multiple related items may
     be changed outside local certainty
3. Remove refetches incrementally, one mutation family at a time.

Acceptance:

- Common edit actions no longer double request count.
- Existing dependency repair behavior is preserved.
- Optimistic state and webhook reconciliation still converge to GitHub state.
- Unit tests cover at least status, title/body, date, and comment mutation paths.

## Phase 5: Batch Fan-Out Writes Where GitHub Permits

Use GraphQL aliasing carefully. Batching reduces HTTP calls but does not make
mutations free; secondary-limit pacing still applies.

1. Add typed helper(s) for aliased project-item field mutations.
2. Batch independent field updates for one item:
   - `updateTaskDates`
   - group-field changes where multiple project fields change together
3. Batch independent position updates only when order semantics are proven:
   - `reorderTaskBlock` currently relies on each previous move's item as the
     next `afterId`
   - verify aliased position mutations execute in the required order before
     replacing the loop
4. Do not assume `handleCreateTask` can collapse to one request:
   - `createIssue` must complete before `addProjectV2ItemById` can use the new
     issue ID
   - repository ID lookup can be cached by `owner/repo/account`
   - field setup after item creation can be batched
   - draft issue creation already creates the project item directly
5. Update `src/lib/githubMock.ts` to support aliased mutation shapes used by
   tests.

Acceptance:

- Batched date save reduces multiple field writes to one request where fields
  exist.
- Create-task flow avoids repeated repository lookup and batches post-create
  field setup.
- Tests prove aliased operations are parsed by the mock layer and preserve order
  assumptions.

## Phase 6: Instrumentation and Verification

Add enough observability to prove the changes reduce cost.

1. Add structured debug logging around real GitHub calls:
   - account key, operation name, operation type, cost headers where available,
     remaining budget, wait duration, retry count
   - never log full tokens
2. Add local/manual test notes in `test/` for:
   - normal edit actions
   - exhausted primary budget simulation
   - secondary-limit simulation
   - account switching
   - project opening/switching
3. Run required project verification for implementation PRs:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
   - focused Vitest tests for new transport/cache/batching behavior

Acceptance:

- Manual smoke test can compare request count before/after using `[GitHubAPI]`
  logs or browser network panel.
- Account switching does not leak limiter or cache state.
- Long reset windows keep the UI usable instead of hanging foreground actions.

## Suggested Implementation Order

1. Phase 1 transport limiter with tests.
2. Phase 2 typed UI handling and localization.
3. Phase 3 read waste reduction.
4. Phase 4 remove refetches mutation family by mutation family.
5. Phase 5 batching, starting with date/field writes.
6. Phase 6 instrumentation/manual test documentation can start in Phase 1 and
   continue throughout.

## Out of Scope

- Replacing the OAuth user-token model with a server-side proxy.
- Token pooling.
- Changing the webhook to Supabase Realtime architecture.
- Changing the dual OAuth-App / GitHub-App architecture.
- Increasing GitHub quota through organization or Enterprise configuration.
