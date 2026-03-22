# Supabase Real-time Setup

Glidelines uses Supabase primarily for its Real-time broadcasting capabilities to push webhook events from GitHub directly to the connected browser clients, ensuring Gantt charts update live without polling.

## 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com/).
2. Click **New Project** and follow the instructions to create a project in your preferred region.

## 2. Retrieve API Keys
You will need both the standard anonymous keys for the frontend and the service role keys for the secure backend Vercel webhook handler.

1. In your Supabase dashboard, go to **Project Settings** (the gear icon).
2. Click on **API** in the sidebar.
3. Locate your **Project URL** and your **anon `public`** key.
4. Locate your **service_role `secret`** key.

## 3. Configure Environment Variables

You need to provide these keys to both the Vite frontend (`VITE_` prefix) and the Vercel backend. 

### Local Development Environment
Add the following to your local `.env.local` file:

```bash
# Frontend Supabase Config
VITE_SUPABASE_URL=https://<your-local-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-local-anon-public-key>

# Backend Supabase Config (Secure)
SUPABASE_URL=https://<your-local-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-secret-key>
```

### Production Deployment Environment
For the live version of your app, you should create a separate Production Supabase project to avoid mixing test data with live user events.

Add the following to your **Vercel Project Settings -> Environment Variables**:

```bash
# Frontend Supabase Config
VITE_SUPABASE_URL=https://<your-live-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-live-anon-public-key>

# Backend Supabase Config (Secure)
SUPABASE_URL=https://<your-live-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-live-service-role-secret-key>
```

> [!WARNING]
> Never expose your `SUPABASE_SERVICE_ROLE_KEY` to the frontend using a `VITE_` prefix! It bypasses Row Level Security and has full admin access to your project. Keep it strictly on the backend (`api/` folder).

## 4. Enable Realtime Channels
Glidelines uses Supabase Realtime Broadcasts. By default, Realtime is enabled on new Supabase projects, but you do not need to enable any specific database tables for replication since we are only using the `Broadcast` feature (Channels), not database Row Level Security subscriptions.

You are fully set up for data streaming!
