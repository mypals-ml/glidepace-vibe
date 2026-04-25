# Glidelines Local Development Environment Guide

To get your local development environment operational, you need to configure the multi-account architecture, link Supabase for real-time updates, and set up a webhook proxy (Smee.io).

Follow these steps sequentially to guarantee a working `localhost` setup:

## 1. Supabase Database Configuration
Because Gantt charts rely on real-time broadcast channels for webhook updates, you need to configure a Supabase project first to acquire your API keys and Service Roles.

👉 **Start Here:** [Read SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## 2. GitHub OAuth App Setup
To allow users to log into your local environment securely and grant permission to read their repository/project data, you must create a GitHub **OAuth App** specifically for your `localhost` callback URLs.

👉 **Next Step:** [Read GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md) (Follow the Local Development section)

## 3. Webhook Setup (Local)
Because GitHub cannot deliver webhooks to `localhost`, you need to set up a [Smee.io](https://smee.io/) proxy channel to forward webhook payloads to your local development server. You will also learn how `vite-plugin-vercel-mock.ts` lets you run everything with `npm run dev` — no Vercel CLI needed. For an even simpler setup without OAuth/Webhooks, use `npm run dev:test` to enable **Mock Mode**.

👉 **Next Step:** [Read WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) (Follow the Local Development section)

> [!TIP]
> Have your Smee.io Webhook Proxy URL ready before proceeding to the next step — you'll paste it when creating your GitHub App.

## 4. GitHub Background Sync App Setup
Because we do not use OAuth for webhooks (to keep user permissions explicit), you need to create a dedicated **GitHub App**. This app handles background triggers (like creating an Issue) and secure backend API checks (via Private Keys). You'll use the webhook URL from Step 3 during app creation.

👉 **Final Step:** [Read GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Follow the Local Dev App section)

## Common Commands

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

---

### Need to Debug?
If you've followed the steps above and are still encountering CORS errors, OAuth loop failures, or Webhook permission denied issues, consult the debugging manifest:
👉 [Read DEBUGGING.md](./DEBUGGING.md)
