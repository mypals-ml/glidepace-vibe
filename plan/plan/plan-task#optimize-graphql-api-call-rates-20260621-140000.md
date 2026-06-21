# Task Plan: Further Optimize GitHub GraphQL API Call Rates & Point Consumption

**Date:** 2026-06-21  
**Supersedes:** `plan/plan/plan-task#optimize-github-api-calling-rate-20260613182228.md` and prior 2026-06-13 variants  
**Trigger:** Reduce GitHub GraphQL request volume and rate-limit pressure after the transport limiter, pagination skips, optimistic updates, and webhook sync work.  
**Deliverable:** Living optimization plan plus implementation notes as rate-limit fixes land.

## Executive Summary

The next optimization should focus on **avoiding full project snapshot reads**. The current app already has good transport throttling, in-flight dedupe, background refresh coalescing, optimistic writes, and several removed write-then-refetch tails. The remaining high-cost path is still `fetchProjectTasks`: each cache miss can page through both project fields and project items, and webhook/manual/initial refresh paths can still escalate to that full snapshot.

The optimized implementation order is:

1. **Project snapshot cache with stale-while-revalidate behavior** for repeat opens and background refreshes.
2. **Create-flow refetch removal** for the common create path, plus explicit invalidation of the snapshot cache after local mutations.
3. **Cost instrumentation before fragment surgery**, so query changes are guided by real point measurements.
4. **Search/comment polish** only after the major snapshot/create waste is reduced.
5. **Operational tuning and manual measurement docs** to make before/after behavior visible.

## Current State Confirmed In Code

Already delivered:

- `GitHubRateLimiter` schedules per token, separates reads from mutations, records rate-limit headers, and retries rate-limit failures with bounded foreground waits.
- `fetchGitHubGraphQL` supports `priority`, `maxWaitMs`, `dedupeKey`, typed errors, and the `VITE_GITHUB_RATE_LIMITER=off` kill switch.
- `GitHubReadCache` provides TTL caching plus in-flight dedupe for `userProjects`, `repositoryId`, and `issueFields`.
- `GET_PROJECT_TASKS_QUERY` uses `@skip(if:)` for completed `fields`/`items` connections.
- `useDashboardSync` dedupes webhook events, guards concurrent single-item fetches, and coalesces background full refreshes.
- Title, description, status, date edits, issue assignees, and comments already use optimistic/local updates in several common paths.
- Comment add/update/delete no longer forces item refresh or full comment re-page.
- Non-draft assignee mutations apply returned assignee nodes and skip the confirmation fetch.
- Background refresh failures keep stale data visible and show rate-limit-aware UX.
- Task details open now renders from the already-loaded task snapshot and lazy-loads comments without automatically calling `fetchSingleProjectItem`.
- Estimate, estimate-unit, auto-update-start-date, and dependency successor edits now rely on optimistic local state plus webhook reconciliation instead of confirmation reads on successful writes.
- Successful dependency link/unlink callers, group/ungroup operations, and task-list reorders avoid full task-list refreshes. Existing failure-only background refreshes remain for partial-persistence repair.
- The forecast-assumptions README loader no longer retriggers when only toast callback identities change; this removes one observed foreground GraphQL query loop.
- Successful full project snapshots are cached in `localStorage` by account and project. If a foreground task refresh hits the GitHub rate limit, the task list uses the cached/current snapshot when available and shows the rate-limit message as a dismissible toast instead of replacing the list with the error text.
- Project selection no longer performs its own immediate `fetchProjectTasks`; the provider's selected-project effect is the single owner of the initial task refresh, avoiding duplicate foreground full snapshots on project open.

Remaining high-cost paths:

- `fetchProjectTasks` still has no fresh-cache/stale-while-revalidate policy for normal initial opens and still performs paginated full snapshots for initial load, manual sync, unknown webhook events, external reorder events, and fallback paths when GitHub is available.
- `handleCreateTask` still ends with an unconditional `fetchSingleProjectItem` after issue/draft creation, field updates, optional group persistence, and optional position mutation.
- Draft assignee edits still call `fetchSingleProjectItem` unless the caller passes `skipRefresh`; this is the remaining narrow selected-item confirmation read.
- Search has in-flight dedupe but no resolved-value TTL for assignable users, org members, or global queries.
- Query cost is not visible in app logs because read queries do not request `rateLimit { cost remaining resetAt }`.
- `PROJECT_ITEM_FRAGMENT` is broad. Trimming it could help, but should be driven by measured cost because mapper correctness depends on issue-backed date fields, project field values, assignees, and field option metadata.

## Goals

- Reduce real GitHub GraphQL calls and point consumption in normal usage without weakening correctness, optimistic UI, webhook-driven sync, or multi-account isolation.
- Make full project snapshots rarer, deduped, and observable.
- Keep stale data available under rate pressure.
- Produce enough instrumentation to compare before/after request counts and GraphQL point cost for common flows.

## Non-Goals

- No server-side proxy, token pooling, or GitHub App token migration.
- No major rewrite of the webhook/Supabase realtime layer.
- No client-side GraphQL cost calculator beyond reading GitHub's reported `rateLimit.cost`.
- No broad fragment split until instrumentation shows it is worth the mapper/test risk.

## Phase 0: Measurement Baseline

Add or collect a baseline before behavior changes so the work has a measurable target.

Implementation notes:

- Use existing `[GitHubAPI]` and dashboard debug logs first; avoid building UI.
- Record request count and, after Phase 3, GraphQL `rateLimit.cost`.
- Test on one small mock project and one large real project if available.

Baseline flows:

- Open a project from cold state.
- Reopen the same project within 30 seconds.
- Manual Sync.
- Webhook single-item edit for a known item.
- Webhook event that falls back to full project refresh.
- External reorder event.
- Create one task with title only.
- Create one task with status, dates/estimate, assignee, group, and insert position.
- Open the same task details panel twice; verify this does not trigger `fetchProjectTasks` or an automatic `fetchSingleProjectItem`.
- Save details fields: title, description, status, estimate, estimate unit, auto-update-start-date, assignees, comments, and group path. Verify none trigger `fetchProjectTasks`, and only explicitly justified cases trigger `fetchSingleProjectItem`.
- Link and unlink tasks from details, sidebar, Gantt, and floating link builder. Verify successful operations do not trigger `fetchProjectTasks`, and align `fetchSingleProjectItem` behavior across callers.
- Rename and ungroup groups. Verify successful operations do not trigger `fetchProjectTasks`; failure-only fallback refreshes should be logged as fallback.
- Reorder one task and a task block in the task list. Verify successful operations do not trigger `fetchProjectTasks`; failure-only fallback refreshes should be logged as fallback.
- Search assignees with empty input and with a 2+ character query.

Acceptance:

- A short before/after table is added to the implementation PR or manual test doc.
- Baseline includes request count for every flow even before `rateLimit.cost` is available.

## Phase 1: Project Snapshot Cache And Stale-While-Revalidate

This is the highest-leverage phase.

### Design

Add a dedicated cache layer for full project snapshots instead of pushing this into generic `GitHubReadCache` only. The full snapshot has more policy than small reads: it needs page-count metadata, forced refresh, stale fallback, and invalidation after local mutations.

Suggested shape:

```ts
interface ProjectSnapshotCacheKeyParts {
  accountId: string;
  projectId: string;
}

interface ProjectSnapshot {
  tasks: Task[];
  fields: GitHubProjectV2Field[];
  statusOptions: string[];
  fetchedAt: number;
  itemCount: number;
  fieldCount: number;
  pageCount: number;
}
```

Cache key:

```ts
dashboard_task_snapshot_v1:${projectAccountId}:${projectId}
```

Policy:

- Fresh TTL: 60 seconds for project snapshots.
- Stale TTL: 5-10 minutes for fallback display when GitHub is rate limited or network fails.
- Account and project must both be part of the key.
- Manual Sync must force a network refresh.
- Initial project open should use a fresh cached snapshot if available, then optionally schedule a background refresh if the entry is near expiry.
- Background webhook refresh may use a stale snapshot only as fallback on failure; it should not replace a network refresh when GitHub is available.

### Implementation Steps

1. Create `src/lib/githubProjectSnapshotCache.ts` with:
   - `getFresh(key)`
   - `getStale(key)`
   - `set(key, snapshot)`
   - `invalidate(key)`
   - `invalidateProject(accountId, projectId)`
   - `clear()`
   - small stats helper for tests/debug logs.
2. Extract the existing `fetchProjectTasks` pagination loop into a private loader inside `useTaskFetch.ts` or a focused helper:
   - Inputs: `projectId`, `token`, `mode`, cursors.
   - Output: raw `allItems`, `allFields`, `pageCount`.
   - Preserve the existing `skipFields` / `skipItems` logic.
3. In `fetchProjectTasks`, decide policy from `FetchProjectTasksOptions`:
   - `reason: 'manual_sync'` means force network and update cache.
   - `mode: 'initial'` may serve fresh cache immediately.
   - `mode: 'background'` should fetch network with `priority: 'background'`, then update cache.
   - On rate-limit/network failure, fall back to stale cache if available.
4. Apply cached snapshots through the same reconciliation path used by network snapshots:
   - Use `reconcileProjectSnapshot`.
   - Preserve viewport only when current background behavior would preserve it.
   - Update `projectFields`, `projectStatusOptions`, and `fieldsProgress` consistently.
5. Cache only after a successful full network snapshot and reconciliation inputs are valid.
6. Add debug logs:
   - `snapshotCache: hit|miss|stale|bypass|write|invalidate`
   - `pageCount`, `itemCount`, `fieldCount`, `ageMs`, `reason`, `mode`.

### Invalidation Rules

Invalidate the project snapshot cache after successful local mutations that change project/task data:

- create task
- delete task
- title/body edit
- status edit
- dates/estimate/unit edit
- assignee edit
- group path edit
- dependency successor/predecessor edit
- reorder/position update
- project field creation or setting changes that affect task mapping

Do not invalidate on failed mutations.

For webhook events:

- Known single-item webhook: do not invalidate the snapshot immediately; merge the single item locally.
- Unknown item, full project, or external reorder webhook: background refresh should bypass fresh cache and write a new cache entry on success.
- Recent local reorder echo: skip refresh and keep cache as-is or update it locally in Phase 2 if that is cheap.

### Acceptance

- Reopening the same project within the TTL performs zero full pagination calls and applies cached tasks/fields.
- Manual Sync always bypasses the fresh cache.
- Background full refresh failures keep visible tasks and can fall back to a stale snapshot.
- Cache isolation is proven by tests for different `accountId` values using the same `projectId`.
- Tests cover fresh hit, stale fallback, force bypass, successful write, and invalidation after mutation.

## Phase 2: Create Flow Without Unconditional Final Fetch

The common create path should end with local state assembled from mutation responses and user input, not an unconditional `fetchSingleProjectItem`.

### Implementation Steps

1. Build the created task locally from:
   - `itemId` returned by `addProjectV2Item` or `addProjectV2DraftIssue`
   - `contentId` returned by `createGitHubIssue` when present
   - user-provided title/body/status/dates/estimate/assignees/group path
   - current project field IDs and options from `projectFields` or existing task metadata
2. Insert the local task immediately:
   - Use `upsertTaskAfter` when a position is requested or append anchor exists.
   - Otherwise append consistently with current behavior.
3. Keep the final `fetchSingleProjectItem` only behind a narrow condition:
   - draft assignee writes where mutation response lacks enough data
   - missing field metadata needed to render/edit the new item
   - a failed position mutation where local ordering cannot be trusted
4. Invalidate the project snapshot cache after a successful create.
5. Document remaining `fetchSingleProjectItem` call sites with short comments explaining why they still need a network read.

### Acceptance

- Title-only task creation removes the final single-item fetch.
- Positioned create still places the task locally in the requested position.
- Complex create with status/date/assignee/group still renders immediately without relying on final fetch for the common issue-backed path.
- Tests cover create success, create with insert position, create mutation failure rollback/no-insert, and conditional final-fetch cases.

## Phase 3: Query Cost Instrumentation Before Fragment Changes

Do this before splitting fragments so query optimization is guided by real data.

### Implementation Steps

1. Add `rateLimit { limit cost remaining resetAt }` to:
   - `GET_PROJECT_TASKS_QUERY`
   - `GET_SINGLE_ITEM_QUERY`
   - `GET_USER_PROJECTS_QUERY`
   - optionally search queries after snapshot/create work lands.
2. Add a small parser/helper that logs rate-limit data when present:
   - operation label
   - cost
   - remaining
   - resetAt
   - cache outcome if applicable.
3. Keep logs dev-oriented; do not add user-visible UI in this phase.
4. Add a manual verification doc update with expected log examples.

### Fragment Audit Rules

Only trim `PROJECT_ITEM_FRAGMENT` after cost logs show a meaningful win is likely.

Audit checklist:

- Keep issue-backed `issueFieldValues` unless date field support is replaced and tested.
- Keep `fieldValues` types needed by `mapProjectItemToTask`.
- Keep status option metadata somewhere. If removed from every item, ensure project-level fields populate `statusOptions` and `estimateUnitOptions` reliably.
- Consider lowering nested limits first (`assignees(first: 20)`, `fieldValues(first: 30)`, `issueFieldValues(first: 30)`) if real projects show waste.
- Prefer one measured small trim over a large list/detail split as the first PR.

Acceptance:

- Full snapshot and single-item logs show GitHub-reported point cost.
- A follow-up note states whether fragment trimming is justified by observed cost.
- No behavior change is introduced by instrumentation alone.

## Phase 4: Detail, Comments, And Search Polish

These are secondary after snapshot/create work.

### Task Detail

- Keep `TaskDetailsContent` free of automatic `fetchSingleProjectItem` calls on panel open. The details panel should render from the already-loaded task snapshot.
- Keep lazy comment loading when the panel opens, because comments are detail-owned data and are not part of the task list refresh contract.
- Do not let comment/detail read failures set the task-list `apiError` or replace the sidebar with the GitHub API error card.
- Account for the current `TaskDetailsPanel` layout mounting both mobile and desktop `TaskDetailsContent` copies; detail-owned fetches must be deduped so hidden CSS copies do not double the call volume.
- If an explicit "refresh this task" action is added later, make it user-initiated and scoped to the details panel, not automatic on open.

### Detail Save Mutations

- Preserve the no-refetch behavior already present for title, description, status, comments, non-draft assignees, and group-path edits.
- Keep estimate-only, estimate-unit, and auto-update-start-date saves on the optimistic no-confirmation-read path. Webhook reconciliation can correct divergence later.
- Keep `updateTaskDates` on no confirmation refetch for successful optimistic field writes, with a narrow opt-in refetch only for genuinely unknown server-derived fields.
- For draft assignees, either:
  - apply optimistic local assignee state from the selected IDs and skip the confirmation fetch, or
  - keep a clearly documented narrow `fetchSingleProjectItem` exception until the draft mutation response supplies enough user data.
- Add tests around `TaskDetailsContent`/mutation hooks that assert saving detail fields never calls `fetchProjectTasks` and does not call `fetchSingleProjectItem` except for documented draft-assignee fallback.

### Links And Unlinks

- Keep dependency link/unlink mutations on no-read-refresh success paths by default.
- Keep Gantt link creation and `FloatingSequenceBuilder` callers on `skipRefresh=true`; confirmation `fetchSingleProjectItem` should remain opt-in.
- Keep the optimistic local successor/predecessor update, cascade recalculation, and rollback-on-failure behavior.
- If dependency persistence fails after partially updating GitHub fields, keep the existing rollback plus targeted repair/fallback strategy; do not introduce an unconditional full task-list refresh on success.

### Groups And Ungroup

- Keep `updateTaskGroupPath`, `renameGroupBlock`, and `ungroupGroupBlock` as no-read-refresh success paths.
- Do not add full snapshot refreshes after successful group rename/ungroup; changed group paths are already persisted item-by-item and applied locally.
- Keep failure-only background full refreshes for complex drag/reorder cases where local order may be untrusted after partial persistence.
- Add logs/tests that distinguish success no-refresh from failure fallback refresh.

### Task-List Reorder

- Keep successful single-task reorder and task-block reorder as no-read-refresh paths.
- Preserve optimistic local ordering plus GitHub `updateProjectV2ItemPosition` persistence.
- Keep the existing failure-only background full refresh for block reorder when local order may be untrusted after partial persistence.
- Ensure local reorder echo suppression continues to prevent webhook-triggered full refreshes from immediately undoing the optimization.

### Comments

- Current mutation paths already update local comment state without re-page.
- Add a per-task comments TTL so reopening the same task details does not immediately re-page comments.
- Invalidate comment cache only after successful local comment mutation or when a webhook indicates that content changed externally.
- Preserve pagination for comment-heavy issues.

### Search

- Add resolved-value TTL caching:
  - assignable users by `accountId:owner/repo:query`
  - org members by `accountId:org`
  - global users by `accountId:query`
- Suggested TTLs:
  - assignable users: 5 minutes
  - org members: 10 minutes
  - global search: 60 seconds
- Keep the existing debounce behavior described in `docs/FEATURES.md`; if actual UI code bypasses debounce, fix that at the component boundary.
- Avoid always firing fallback/global search if assignable/org results are already sufficient for empty queries.

Acceptance:

- Opening a task details panel does not call `fetchProjectTasks`.
- Opening a task details panel does not automatically call `fetchSingleProjectItem`.
- Opening details while GitHub is rate limited keeps the task list visible.
- Detail/comment fetch failures are surfaced non-blockingly and do not set the full-project `apiError`.
- Saving detail fields does not trigger `fetchProjectTasks`.
- Estimate, estimate-unit, and auto-update-start-date saves do not trigger `fetchSingleProjectItem` after their optimistic update succeeds.
- Successful dependency link/unlink operations from details, sidebar, Gantt, and floating builder do not trigger `fetchProjectTasks` and do not call `fetchSingleProjectItem` unless an explicit opt-in reason is documented.
- Successful group path, rename, and ungroup operations do not trigger any read refresh.
- Successful task-list single-task and block reorder operations do not trigger `fetchProjectTasks`.
- Complex group/reorder failure fallbacks remain background-only and are observable in logs.
- Reopening task details within TTL does not re-fetch comments.
- Reopening the assignee picker does not repeat empty-query org/assignable calls within TTL.
- Search cache keys include account scope.

## Phase 5: Tuning, Kill Switches, And Documentation

### Implementation Steps

1. Add cache/debug stats:
   - project snapshot cache size
   - hit/miss/stale/bypass counts
   - page count for last full snapshot
   - optional `githubRateLimiter.getState(token)` dump in dev logs.
2. Keep a kill switch:
   - Either reuse `VITE_GITHUB_RATE_LIMITER=off` only for transport, or add a narrower `VITE_GITHUB_SNAPSHOT_CACHE=off`.
   - Prefer a narrow snapshot-cache kill switch if Phase 1 touches enough behavior to warrant rollback.
3. Update manual verification docs:
   - likely `test/GITHUB_RATE_LIMIT_OPTIMIZATION_MANUAL.md`
   - include network-tab steps and expected cache/cost logs.
4. Tune after measurement:
   - snapshot fresh TTL
   - stale TTL
   - background refresh `maxWaitMs`
   - search TTLs
   - read concurrency only if logs show queuing remains painful.

Acceptance:

- Engineers can answer: "Was this served from cache?", "How many pages did the full snapshot fetch?", and "How many GraphQL points did this cost?"
- Manual doc includes before/after request counts for the baseline flows.
- Snapshot cache can be disabled independently if needed.

## Suggested PR Split

1. **PR 1: Baseline + Snapshot Cache**
   - Project snapshot cache
   - `fetchProjectTasks` cache policy
   - cache tests
   - logs for hit/miss/page count
2. **PR 2: Create Flow Refetch Removal**
   - local created-task assembly
   - cache invalidation after mutations
   - tests for create/position/fallback
3. **PR 3: Cost Instrumentation**
   - `rateLimit` fields
   - logging helper
   - manual verification doc update
4. **PR 4: Detail/Mutation/Search Polish**
   - remove automatic details-open item refetch
   - remove remaining optimistic detail-save confirmation refetches
   - standardize dependency link/unlink no-refetch success paths
   - keep group/ungroup success paths read-refresh-free
   - detail/comment/search TTL caches
   - focused tests
5. **PR 5: Fragment Trim, Only If Justified**
   - one measured query reduction at a time
   - mapper regression tests

## Test Plan

Required automated checks for code PRs:

- `npm run lint`
- `npm run type-check`
- `npm run build`
- Focused Vitest coverage for new cache and create-flow behavior.

Suggested focused tests:

- `githubProjectSnapshotCache.test.ts`
- `useTaskFetch` cache-policy tests using mocked `fetchGitHubGraphQL`
- create-flow tests for no final fetch in common path
- account/project cache isolation
- stale fallback after rate-limit error
- mutation invalidation success vs failure
- details-open no `fetchProjectTasks` / no automatic `fetchSingleProjectItem`
- detail-save mutation tests for title, description, status, estimate, estimate unit, auto-update-start-date, assignees, comments, and group path
- dependency link/unlink no-read-refresh tests for details/sidebar/Gantt/floating-builder callers
- group rename/ungroup no-read-refresh success tests and failure fallback tests
- comments/search TTL tests when implemented

Manual verification:

- Use `npm run dev:test` for mock behavior.
- Use a real large project for point-cost verification because mock mode cannot validate GitHub `rateLimit.cost`.
- Capture network request counts before and after for the baseline flows.

## Risks And Mitigations

- **Stale project snapshot after external edits:** Use short fresh TTL, webhook single-item reconciliation, and forced network refresh for manual sync, unknown items, full-project events, and external reorder.
- **Serving the wrong account's data:** Include `projectAccountId` in every cache key and test account isolation.
- **Local create state diverges from GitHub:** Keep a narrow conditional final fetch for cases where mutation responses lack required data; webhooks reconcile later.
- **Fragment trimming breaks mapping:** Instrument first, trim only with mapper tests for issue-backed dates, project field values, assignees, status options, and dependencies.
- **Cache memory growth:** Bound snapshot cache by entry count or clear on account/project switch if usage grows.
- **Over-caching during active editing:** Invalidate after successful local mutations and bypass cache for explicit/manual refresh paths.

## Success Metrics

- Reopening a recently viewed project within TTL performs zero full pagination calls.
- Background webhook bursts still coalesce and do not add duplicate full snapshots.
- Title-only create removes one `fetchSingleProjectItem` call.
- Task detail/comment reopen and assignee picker reopen avoid repeat reads within TTL.
- Logs show lower request count and, after instrumentation, lower or better-understood GraphQL point cost for the baseline flows.

## Next Step

Implement **PR 1: Baseline + Snapshot Cache** first. Keep the diff focused on the cache module, `fetchProjectTasks` policy, logs, and tests.

Reference files:

- `src/hooks/dashboardTasks/useTaskFetch.ts`
- `src/hooks/dashboardTasks/useTaskCrud.ts`
- `src/hooks/dashboardTasks/useTaskMutations.ts`
- `src/hooks/dashboardTasks/useTaskComments.ts`
- `src/hooks/dashboardTasks/useUserSearch.ts`
- `src/hooks/useDashboardSync.ts`
- `src/lib/githubReadCache.ts`
- `src/lib/githubRateLimiter.ts`
- `src/lib/githubService.ts`
- `src/lib/githubQueries.ts`
- `src/lib/githubTaskMapper.ts`
- `test/GITHUB_RATE_LIMIT_OPTIMIZATION_MANUAL.md`
