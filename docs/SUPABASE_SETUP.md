# Supabase Real-time Setup

Glidelines uses Supabase primarily for its **Real-time Broadcast** capabilities. It acts as a lightweight relay to push webhook events from GitHub directly to connected browser clients, ensuring Gantt charts update live without polling or manual refreshes.

## 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com/).
2. Click **New Project** and follow the instructions to create a project in your preferred region.

> [!TIP]
> A single Supabase project is sufficient for both local development and production. Since Glidelines only uses Supabase Realtime Broadcast channels (ephemeral signals, no persistent data), there is no risk of mixing test data with live data.

## 2. Retrieve API Keys
You will need both the standard anonymous keys for the frontend and the service role keys for the secure backend Vercel webhook handler.

1. In your Supabase dashboard, go to **Project Settings** (the gear icon).
2. Click on **API** in the sidebar.
3. Locate your **Project URL** and your **anon `public`** key.
4. Locate your **service_role `secret`** key.

## 3. Configure Environment Variables

### Local Development (`.env.local`)

Add **all four** variables to your Vercel's Local Development Environment and pull to the local `.env.local` file.
Locally, everything runs on your machine — Vite serves the frontend and `vite-plugin-vercel-mock.ts` runs the API handlers in the same process:

```bash
# Frontend — used by React to subscribe to Realtime channels
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>

# Backend — used by api/github-webhook.ts to broadcast events
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
```

### Production (Vercel Dashboard)

Add the **same four** variables to your **Vercel Project Settings → Environment Variables**. Vercel automatically handles security scoping:

| Variable | Used by | Vercel exposes to |
|---|---|---|
| `VITE_SUPABASE_URL` | React frontend | Browser (bundled into client JS) |
| `VITE_SUPABASE_ANON_KEY` | React frontend | Browser (bundled into client JS) |
| `SUPABASE_URL` | `api/github-webhook.ts` | Serverless functions only |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/github-webhook.ts` | Serverless functions only |

> [!NOTE]
> The values are **identical** between local and production — it's the same Supabase project. You just configure them in two different places because local dev reads from a file while production reads from the Vercel dashboard.

> [!WARNING]
> Never expose your `SUPABASE_SERVICE_ROLE_KEY` to the frontend using a `VITE_` prefix! It bypasses Row Level Security and has full admin access to your project. Keep it strictly on the backend (`api/` folder).

## 4. Enable Realtime Channels
Glidelines uses Supabase Realtime Broadcasts. By default, Realtime is enabled on new Supabase projects, but you do not need to enable any specific database tables for replication since we are only using the `Broadcast` feature (Channels), not database Row Level Security subscriptions.

You are fully set up for data streaming!
