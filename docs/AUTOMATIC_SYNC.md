# Automatic Sync via GitHub Webhooks (Supabase)

This project supports automatic task synchronization using GitHub Webhooks and Supabase Realtime as a relay. 

## Dual Architecture Explained
Glidelines uses a **Dual Architecture** to handle data efficiently and safely:
1. **OAuth App:** Handles the frontend login and fetches ALL your projects securely.
2. **GitHub App:** Exists **strictly** for webhooks to power this automatic sync feature in the background.

## How it Works
1.  **GitHub Event**: When an issue or project item is updated on GitHub, your installed GitHub App sends a webhook to `/api/github-webhook`.
2.  **Webhook Handler**: The Vercel serverless function receives the event and triggers a Supabase Realtime broadcast.
3.  **Real-time Update**: The frontend listens for the broadcast event and automatically calls `fetchProjectTasks` to update the dashboard.

## Setup Instructions

### 1. Supabase Setup
- Create a project at [Supabase](https://supabase.com/).
- Go to **Project Settings** > **API**.
- Note your `Project URL`, `anon public key`, and `service_role secret`.
- **Important**: Ensure Realtime is enabled for your project (Go to Realtime settings in the dashboard).

### 2. GitHub Webhook Setup
To enable automatic sync across organizations without manual setup per-repository, you must create a GitHub App specifically for webhook relay.
- Follow the instructions in [`GITHUB_APP_SETUP.md`](./GITHUB_APP_SETUP.md) to set up the Webhook App.
- After logging in using the OAuth app, the user will be prompted to "Install" the GitHub App on their desired organizations to activate automatic sync for them.

### 3. Environment Variables
Add the following to your Vercel project settings or `.env.local`:

```env
# 1. OAuth App (Frontend Login & Data)
VITE_GITHUB_OAUTH_CLIENT_ID=your_oauth_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_oauth_client_secret

# 2. GitHub App (Background Webhooks)
VITE_GITHUB_APP_INSTALL_URL=https://github.com/apps/your-app-name
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# 3. Supabase Relays
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Troubleshooting
- Check the **Vercel Logs** for incoming webhook activity at `/api/github-webhook`.
- Check the **Supabase Dashboard** for Realtime connection status.
- Ensure `selected_project` is active in the dashboard for the listener to subscribe.
