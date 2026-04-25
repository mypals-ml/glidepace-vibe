# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Glidelines** — a reactive Gantt chart dashboard for managing GitHub Projects V2. It visualizes project items as an MS Project-style timeline, with real-time sync via GitHub webhooks relayed through Supabase.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run dev:test     # Dev server with mock data (VITE_USE_MOCK_DATA=true via .env.test)
npm run build        # TypeScript compile + Vite production build
npm run type-check   # tsc -b (type-check only, no emit)
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run verify       # Runs check.sh (PATH setup) then type-check + lint — MANDATORY before completing tasks
```

**Important**: `npm run verify` must pass before pushing. The pre-push Husky hook enforces lint + type-check. `check.sh` configures PATH to find Node.js at `/opt/homebrew/opt/node@22/bin`.

To run a single test file:
```bash
npx vitest run src/lib/dateUtils.test.ts
```

## Architecture

### Data Flow

```
GitHub GraphQL API
       ↓
githubService.ts (real or mock based on VITE_USE_MOCK_DATA / token value)
       ↓
DashboardProvider.tsx (global state via React Context — 47KB, the core brain)
       ↓
Components consume via useDashboard() hook
```

Real-time updates flow through: GitHub Webhook → `/api/github-webhook.ts` (Vercel) → Supabase broadcast → DashboardProvider subscription.

### Key Directories

- `src/context/` — `DashboardProvider.tsx` holds all application state and GitHub API calls. `DashboardContext.ts` has the type definitions.
- `src/lib/` — `githubService.ts` (GraphQL wrapper), `githubMock.ts` (23KB mock handler), `githubTaskMapper.ts` (converts GitHub GraphQL responses to `Task` types), `dateUtils.ts` (Gantt date math).
- `src/components/` — Feature-organized: `Header/`, `Dashboard/` (Sidebar + Timeline), `Modals/`.
- `src/types/index.ts` — All shared types. Always add types here, not inline.
- `api/` — Vercel serverless functions: OAuth callback, webhook receiver, GitHub App installation check.
- `vite-plugin-vercel-mock.ts` — Custom Vite plugin that mocks `/api` routes locally.

### Mock Data System

Mock mode activates when:
- `VITE_USE_MOCK_DATA=true` (set in `.env.test`)
- Token equals `mock-token`
- Project ID is `PVT_2` or `PVT_3`
- Item IDs start with `item-`

`githubMock.ts` is a comprehensive GraphQL handler that supports full Gantt chart interaction without a real GitHub connection. Use `npm run dev:test` for UI development.

## TypeScript Rules

- Strict mode enforced: no `any`, no unused variables/parameters, erasable syntax only.
- All configs split across `tsconfig.json` (root), `tsconfig.app.json` (frontend), `tsconfig.api.json` (serverless), `tsconfig.node.json` (build tools).

## Localization

All user-visible strings must go through i18next — no hardcoded UI strings. Translations are in `src/i18n.ts` for EN, JA, and ZH-CN.

## Git Workflow

- Develop on `develop`, release via PR to `release` — never commit directly to `release`.
- Pre-push hook runs lint + type-check. Fix issues before pushing, do not use `--no-verify`.

## Docs

Detailed references in `docs/`:
- `ARCHITECTURE.md` — component and data layer breakdown
- `LOCAL_DEVELOPMENT.md` — environment setup
- `SUPABASE_SETUP.md`, `GITHUB_OAUTH_SETUP.md`, `GITHUB_APP_SETUP.md` — service configuration
