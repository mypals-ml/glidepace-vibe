# Manual Test Notes — GitHub API Rate-Limit Optimization

Plan: `plan/plan/plan-task#optimize-github-api-calling-rate-20260613093023.md`

These steps verify the Phase 1–5 changes against a real GitHub project. Watch the
browser DevTools **Network** panel (filter: `graphql`) and the **Console**
(`[GitHubAPI]` lines) while exercising each flow.

## Setup

- Run `npm run dev` and open a real GitHub Project (not mock mode).
- Kill-switch: to fall back to the legacy raw-fetch transport, set
  `VITE_GITHUB_RATE_LIMITER=off` and restart. Leave unset/`on` for normal runs.

## 1. Normal edit actions issue fewer requests (Phase 4)

| Action | Before | Expected now |
| --- | --- | --- |
| Change a task status | 2 (write + refetch) | 1 (write only) |
| Edit a task title | 2 | 1 |
| Edit a task description | 2 | 1 |
| Change issue assignees | 2–3 | 1–2 (no refetch) |
| Add / edit / delete a comment | write + item refetch + full comment re-page | 1 (write only) |

Pass: the Network panel shows the reduced count and the UI still reflects the
change immediately (optimistic state).

## 2. Multi-field date save is batched (Phase 5)

- Open a task, set start date + estimate + unit together and save.
- Expect a **single** `graphql` request whose body contains
  `mutation BatchUpdateFields` with `u0:`/`u1:`… aliases — not one request per
  field.

## 3. Project open/switch avoids redundant reads (Phase 3)

- Open project A, switch to B, switch back to A within ~30s.
- Expect the user-projects query to be served from cache on the repeat (no new
  `viewer { projectsV2 }` request) until the TTL elapses.
- The full project snapshot should stop re-requesting a connection once it is
  fully paged (large projects: later page requests omit the completed
  `fields`/`items` connection via `@skip`).

## 4. Rate-limit exhaustion is non-fatal (Phase 1–2)

Simulate by temporarily lowering the foreground budget or using an
already-throttled token:

- Foreground action while limited: it waits up to the budget, then either
  succeeds or shows the localized "GitHub rate limit reached. Showing the last
  known state." message. The task list is **not** blanked.
- Background refresh while limited: existing tasks stay on screen; a calm toast
  appears. Console shows `⏳ rate limited … waiting Nms before retry`.
- Secondary limit: no rapid retry storm; a single wait then one retry.

## 5. Multi-account isolation (Phase 1)

- Connect two GitHub accounts. Exhaust/limit account A.
- Confirm actions on account B proceed without being throttled by A's state.

## 6. Account switch leaks no state (Phase 1, 3)

- Switch the browsing account; confirm cached project lists and limiter pacing
  do not carry over incorrectly (each account keyed separately).

## Kill-switch regression

- With `VITE_GITHUB_RATE_LIMITER=off`, confirm the app still works (legacy path)
  and that the rate-limit retry/backoff behavior is absent (a limit surfaces as
  the original hard error). Re-enable afterward.
