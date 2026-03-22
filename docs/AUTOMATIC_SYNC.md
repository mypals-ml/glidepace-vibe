# Automatic Sync via GitHub Webhooks (Supabase)

This project supports automatic task synchronization using GitHub Webhooks and Supabase Realtime as a relay.

## How it Works
1.  **GitHub Event**: When an issue or project item is updated on GitHub, it sends a webhook to `/api/github-webhook`.
2.  **Webhook Handler**: The Vercel serverless function receives the event and triggers a Supabase Realtime broadcast.
3.  **Real-time Update**: The frontend listens for the broadcast event and automatically calls `fetchProjectTasks` to update the dashboard.

## Setup Instructions

### 1. Supabase Setup
- Create a project at [Supabase](https://supabase.com/).
- Go to **Project Settings** > **API**.
- Note your `Project URL`, `anon public key`, and `service_role secret`.
- **Important**: Ensure Realtime is enabled for your project (Go to Realtime settings in the dashboard).

### 2. GitHub Webhook Setup
- **For OAuth Apps (Current Setup)**: Webhooks must be added **manually** to each Repository or Organization because OAuth permissions are user-level, not repo-level.
  - Go to your GitHub Repository/Org Settings > **Webhooks**.
  - **Payload URL**: `https://your-vercel-domain.app/api/github-webhook`
  - **Content type**: `application/json`
  - **Secret**: Must match your `GITHUB_WEBHOOK_SECRET`.
  - **Events**: Select "Project v2 items", "Issues", and "Pushes".

- **For GitHub Apps (Recommended for Production)**: 
  - If you convert this project to a **GitHub App**, you can configure these webhooks once in the App settings.
  - Users only need to "Install" the app on their Org/Repo for sync to work automatically.
  - No manual webhook configuration is required for individual users.

### 3. Environment Variables
Add the following to your Vercel project settings or `.env.local`:

```env
# Backend (Vercel Functions Env)
GITHUB_WEBHOOK_SECRET=your_secret_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend (Vite)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Troubleshooting
- Check the **Vercel Logs** for incoming webhook activity at `/api/github-webhook`.
- Check the **Supabase Dashboard** for Realtime connection status.
- Ensure `selected_project` is active in the dashboard for the listener to subscribe.
