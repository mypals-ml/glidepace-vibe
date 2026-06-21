# Task Plan: Further Optimize GitHub GraphQL API Call Rates & Point Consumption

**Date:** 2026-06-21  
**Supersedes:** `plan/plan/plan-task#optimize-github-api-calling-rate-20260613182228.md` (and prior variants from 2026-06-13)  
**Trigger:** User request to reduce GraphQL API call volume / rate limit pressure after substantial prior work on transport limiting.  
**Deliverable:** This plan document only. No code changes in this step.

## Executive Summary / Current State

Significant rate-limit hardening and waste reduction has already been delivered:

- Token-scoped `GitHubRateLimiter` (`githubRateLimiter.ts`): per-account lanes, 1s mutation pacing, 4 concurrent reads, bounded retry with jitter, primary vs secondary classification, header recording (`x-ratelimit-*` + `retry-after`).
- `fetchGitHubGraphQL` + `runWithRetry` in `githubService.ts` with priority (`foreground`/`background`), `maxWaitMs`, `dedupeKey`, kill-switch (`VITE_GITHUB_RATE_LIMITER=off`), and typed errors.
- `GitHubReadCache`: TTL + in-flight deduplication (used for `userProjects`, `repositoryId`, `issueFields`; single-item uses `dedupeKey`).
- Pagination improvements in `GET_PROJECT_TASKS_QUERY`: `@skip(if: ...)` + cursor logic avoids re-requesting finished `fields`/`items` connections.
- Coalesced background full refreshes + per-item in-flight guards in `useDashboardSync`.
- Optimistic updates + "skip refetch" paths for title, description, many assignees, and (conditionally) dates.
- `batchUpdateProjectV2ItemFields` (aliased multi-field) used by `updateTaskDates`.
- Webhook → Supabase Realtime + reconciliation reduces polling dependence.
- Graceful "rate limit reached, showing last known state" UX (no data loss).
- Good test coverage and structured `[GitHubAPI]` logging.

Despite this, power users, large projects, frequent tab switches, or manual syncs can still exhaust the ~5,000-point primary GraphQL budget (or trigger secondary limits).

## Goal

Further reduce the number and cost (points) of real GitHub GraphQL calls during normal usage while preserving correctness, real-time feel via webhooks, optimistic UI, and multi-account isolation. Make full refreshes rarer and cheaper when they do occur.

## Root Causes of Remaining Call Volume

1. **Full project snapshot is uncached** — `fetchProjectTasks` (50-item pages over items + fields) runs on:
   - Initial project open
   - Manual sync
   - Many webhook "full_project" or unknown-item events
   - Background coalesced refreshes
   No short/medium TTL cache for the authoritative snapshot.

2. **Create task path is still chatty** — sequential repo lookup (cached), create issue, add to project, status/dates/assignees/group/position, then final `fetchSingleProjectItem`.

3. **Targeted refetches linger** — `fetchSingleProjectItem` (with `dedupeKey`) still called after some assignees, non-date field edits, and unconditionally in create flow.

4. **Comments are paged on demand with full re-fetch** on task detail open; mutations append but don't always prevent later full pages.

5. **Search fan-out** — up to 3 user search queries per open (assignable, org, global) with only per-call dedupeKeys.

6. **No client-visible point costing** — queries don't request the `rateLimit { cost remaining resetAt }` object, so the client cannot make smarter "is this worth it?" decisions.

7. **Fragment bloat** — `PROJECT_ITEM_FRAGMENT` (and related) pulls many fields on every item even for list views. Every paged item costs points.

8. **Refresh triggers** — some webhook paths and UI actions still escalate to full snapshot instead of targeted + merge.

9. **No project-level snapshot cache invalidation strategy** that plays nicely with webhooks (webhooks currently drive refreshes).

## Proposed Phases (in priority order)

### Phase 1: Snapshot Caching + Intelligent Invalidation (highest leverage)

1. Extend `githubReadCache` (or introduce a dedicated project snapshot cache) with a medium TTL (e.g. 60–120s) for the combined fields + items result, keyed by `project:${account}:${projectId}`.
2. Store the raw paged data (or the post-map `Task[]` + `projectFields`) so `fetchProjectTasks` can short-circuit when fresh data exists.
3. Invalidate on:
   - Successful local mutations we are confident about (use the same optimistic paths).
   - Explicit "force" from manual sync or project switch.
   - Selected webhook events that indicate broad change (keep coalescing).
4. Preserve the existing `skipFields`/`skipItems` pagination logic inside the loader when a cache miss occurs.
5. Add `priority: 'background'` and higher `maxWaitMs` tolerance for cache-refresh paths.

**Acceptance**
- Opening a recently viewed project within TTL performs 0 or 1 light call instead of full pagination.
- Cache is correctly scoped per account + project; switching accounts never serves wrong data.
- Manual "Sync" and initial load still bypass or bust cache as expected.
- Rate-limit during background refresh still shows last known snapshot.

### Phase 2: Eliminate the "Final Fetch" on Create + More Skip-Refetch

1. Make the create sequence (`handleCreateTask`) fully self-contained:
   - Use mutation responses + optimistic temp task for as many fields as possible.
   - Only call `fetchSingleProjectItem` when truly necessary (e.g. complex computed fields or after position that webhook will also cover).
2. Expand `skipRefresh` / optimistic patterns to more paths (status is already good; extend to more field edits).
3. For assignees on non-draft: the add/remove mutations already return nodes — make the `skipRefresh` path the default.
4. Document every remaining `fetchSingleProjectItem` call site with a justification.

**Acceptance**
- Task creation performs fewer sequential round-trips (target: remove or conditionalize the final fetch for the common case).
- No regression in group path, position, or auto date correction.
- Unit tests cover create + immediate local state without relying on the final fetch.

### Phase 3: Query Cost & Fragment Optimization

1. Add the rate-limit cost object to the two highest-volume read queries (`GET_USER_PROJECTS_QUERY`, `GET_PROJECT_TASKS_QUERY`, optionally single item):
   ```graphql
   rateLimit {
     limit
     cost
     remaining
     resetAt
   }
   ```
   Log or surface it (dev only or via debug event).

2. Review `PROJECT_ITEM_FRAGMENT` and related fragments:
   - Split into "list" (minimal) vs "detail" (full) versions if a view only needs subset.
   - Remove fields not used by current UI (audit via grep + runtime).
   - Consider `issueFieldValues` vs project `fieldValues` duplication.

3. Consider lightweight "header only" query for quick "has anything changed" checks (using `updatedAt` on content + items connection totalCount + max updatedAt heuristic) before deciding on full snapshot.

**Acceptance**
- At least one major query now reports its own `cost` and `remaining`.
- Documented point cost reduction (or at least no increase) for list views.
- Fragment audit notes added to `docs/` or the plan artifacts.

### Phase 4: Comments, Search, and Minor Hot Paths

1. Comments:
   - Fetch comments only when the details panel is actually opened (lazy).
   - On successful add/update/delete, append/update the local list from the mutation response instead of scheduling a full re-page.
   - Keep pagination for the initial load of a comment-heavy task.

2. User search:
   - Increase TTL on org members / assignable results (they change slowly).
   - Debounce the search input before issuing the query.
   - Consider a combined "smart search" that falls back instead of always firing 2–3 parallel queries.

3. Other:
   - Ensure `getRepositoryId` cache is always hit during create.
   - Review ForecastDashboard and other non-gantt views for unnecessary re-triggers of task data.

**Acceptance**
- Opening task details with comments does not always re-page the entire comment history.
- Assignee picker searches feel snappier and issue fewer calls.

### Phase 5: Observability, Tuning & Kill Switches

1. Enhance `[GitHubAPI]` logging to include (when present):
   - `cost`, `remaining`, `resetAt` from responses.
   - Whether a call was served from read cache.
   - Snapshot page count and total items/fields fetched.

2. Add a small dev-only or "debug" panel (or just console command) that dumps current `githubRateLimiter.getState(token)` + cache stats.

3. Tune defaults after real usage:
   - Read concurrency (currently 4)
   - Mutation pacing (currently 1000ms)
   - Various READ_CACHE_TTL values
   - Background vs foreground budgets

4. Document a manual verification checklist (network tab + logs) similar to the existing `test/GITHUB_RATE_LIMIT_OPTIMIZATION_MANUAL.md`.

**Acceptance**
- Engineers can quickly see "this action cost X points and used the cache".
- A follow-up PR can include before/after call counts for common flows.

## Suggested Implementation Order

1. Phase 1 (snapshot cache) — biggest win for repeat opens and background work.
2. Phase 2 (create + skip-refetch hygiene) — removes obvious waste.
3. Phase 3 (cost + fragment) — cheap to add, informs future tuning.
4. Phase 4 (comments/search polish).
5. Phase 5 (observability & tuning) — can run in parallel with the above.

Each phase should include:
- Focused Vitest tests (cache behavior, invalidation, skip paths).
- `npm run lint && npm run type-check && npm run build`.
- Manual smoke in a real project (large item count preferred).
- Update of relevant walkthrough / debug docs if behavior changes.

## Risks & Mitigations

- **Stale snapshot after external edits** — Mitigated by webhook realtime + reconciliation (already strong) + explicit cache bust on manual sync.
- **Eventual consistency on dates** — Already handled with `localUpdateTimestamp` + merge rules; keep the same discipline.
- **Cache memory** — Current cache is small (per-account/project); add a bounded size if it grows.
- **Test mock fidelity** — Ensure `githubMock.ts` continues to support new cache keys / skip variables.
- **Over-caching during active editing** — Use short TTLs (or invalidate on local mutation success) and always honor "force" / background full refresh signals.

## Out of Scope (for this round)

- Server-side proxy or token pooling to multiply quotas.
- Switching from user PATs/OAuth to GitHub App installation tokens for higher limits.
- Major architecture change to the webhook/Supabase realtime layer.
- Client-side GraphQL query cost calculator (beyond adding the `rateLimit` fragment).
- Automatic query splitting / field selection based on current dashboard view.

## Metrics of Success

- Common user flows (open project, edit 5 tasks, create 1 task, open comments) show measurable reduction in network requests (via browser devtools or `[GitHubAPI]` logs).
- Fewer "rate limit reached" banners for the same usage pattern.
- Power users report being able to work with large projects without hitting the wall as quickly.

---

**Next step after approval of this plan:** Create an implementation sub-task or PR that tackles Phase 1 first, with a small focused diff.

Reference previous work:
- `plan/plan/plan-task#optimize-github-api-calling-rate-20260613182228.md`
- `src/lib/githubRateLimiter.ts`, `src/lib/githubService.ts`, `src/lib/githubReadCache.ts`
- `test/GITHUB_RATE_LIMIT_OPTIMIZATION_MANUAL.md`
