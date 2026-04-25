# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glidelines is a Reactive Gantt Chart dashboard for GitHub Projects V2. It renders tasks, dependencies, and timelines across Web, iOS, and Android (via Capacitor) using React + Vite + TypeScript + Tailwind v4, with Supabase broadcast channels relaying GitHub webhooks in real time.

See `README.md` for the feature overview and `RULES.md` for the full set of project conventions — both should be treated as authoritative alongside this file.

## Commands

Node is at `/opt/homebrew/opt/node@22/bin` on this machine — prepend to `PATH` if `npm` is not found.

- `npm run dev` — normal dev server (real GitHub OAuth, real Supabase).
- `npm run dev:test` — dev server with `--mode test`, loads `.env.test` (sets `VITE_USE_MOCK_DATA=true`) and serves `src/lib/mockData.ts` instead of hitting GitHub.
- `npm run build` — runs `tsc -b` then `vite build`.
- `npm run type-check` — `tsc -b` only.
- `npm run lint` — ESLint across the repo.
- `npm test` — `vitest run` (single pass). Run a single file: `npx vitest run src/lib/dateUtils.test.ts`.
- **Post-task verification is mandatory** per `RULES.md`: run `npm run lint`, `npm run type-check`, and `npm run build` before finalizing changes.

## Architecture

### Dual-path API layer

The app has **two entry paths for backend code** that share the same source:

1. **Production (Vercel):** Files in `api/*.ts` are deployed as Vercel Serverless Functions. Any new API endpoint must live here — Vercel does not pick up routes anywhere else.
2. **Local dev:** `vite-plugin-vercel-mock.ts` intercepts requests to `/api/github-oauth-callback`, `/api/check-github-app-installation`, and `/api/github-webhook` from the Vite dev server, polyfills the Vercel request/response shape (`req.query`, `req.body`, `req.rawBody`, `res.status`, `res.json`), injects secrets from `.env.local` into `process.env`, and delegates to the exact same handler modules. **When adding a new API route, register it in the `handledRoutes` list in `vite-plugin-vercel-mock.ts`** or it will 404 locally.

### Dual GitHub app model

Two GitHub apps are wired up on purpose — do not merge them:

- **OAuth App** — user authentication and scoped Projects V2 queries. Token exchange goes through `api/github-oauth-callback.ts`.
- **GitHub App** — background webhooks and installation-scoped API checks. Webhook payloads hit `api/github-webhook.ts`, signatures are verified, and the event is rebroadcast through Supabase.

### Multi-account architecture

Multiple connected GitHub accounts are stored in `localStorage` and the user switches the "active" one in the UI. Code that reads credentials must go through the account-switching helpers rather than assuming a single token.

### Real-time relay

GitHub webhook → `api/github-webhook.ts` (verifies signature) → Supabase broadcast channel → all connected browser clients update. For local webhook testing, a Smee.io proxy forwards to the Vite middleware (see `docs/WEBHOOK_SETUP.md`).

### Frontend shape

- `src/App.tsx` is a tiny router: `/help/org-projects` renders `HelpOrgProjects`, everything else renders `GanttDashboard`.
- `src/context/DashboardProvider.tsx` + `DashboardContext.ts` own shared dashboard state.
- `src/components/Dashboard/` holds the split-pane UI (Sidebar task list + Timeline Gantt).
- `src/lib/githubService.ts` wraps the GraphQL calls; `src/lib/githubMock.ts` + `mockData.ts` mirror the same surface for `VITE_USE_MOCK_DATA=true`.
- `src/lib/dateUtils.ts` is the cascade engine (date math, dependency shifts) and has real unit tests in `dateUtils.test.ts` — new core-logic utilities should follow this pattern.

## Project-specific rules (from `RULES.md`)

- **Strict TypeScript** — no `any` without strong justification.
- **i18n for all user-facing strings** — no hardcoded text in UI; use `src/i18n.ts`. Supported locales: EN, JA, ZH-CN.
- **Never set `USE_MOCK_DATA = true` in source** — always gate through the `VITE_USE_MOCK_DATA` env var.
- **Branch flow:** never push directly to `release`. All changes flow via PR from `develop` → `release` with manual human review.
- **APIs must live in `api/`** for Vercel deployment.
- **Update `docs/FEATURES.md`** whenever a feature is added, modified, or removed.
- **Add mock fixtures to `src/lib/mockData.ts`** when a new feature needs authenticated data for `dev:test`.

## AI assistant protocol

- "Add a task in the github task project" means: add it to the project named in `docs/PROJECT_INFO.md` **and** convert it into a GitHub Issue.
- Do not add a `JULES` label without explicit user confirmation.
