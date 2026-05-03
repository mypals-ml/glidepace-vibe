# Webhook Setup Guide

Glidelines uses GitHub webhooks to receive real-time notifications (issue changes, project updates) and broadcast them to connected browsers via Supabase Real-time. This guide explains how to set up the webhook URL and proxy it for local development.

> [!TIP]
> Complete this step **before** creating your GitHub App ([GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md)), since you'll need the webhook URL during app creation.

---

## Local Development (smee.io)

GitHub cannot deliver webhooks to `localhost`. To work around this, we use [Smee.io](https://smee.io/) as a free webhook proxy that forwards payloads to your local machine.

### Step 1: Create a Smee Channel

1. Go to [https://smee.io/](https://smee.io/).
2. Click **"Start a new channel"**.
3. Copy the **Webhook Proxy URL** (e.g., `https://smee.io/AbCdEfGhIjKl`).
4. Save this URL — you will paste it as the **Webhook URL** when creating your local GitHub App in [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md).

### Step 2: Run the Smee Client

In a **separate terminal**, run the following command to forward webhooks from your Smee channel to your local dev server:

```bash
npx smee-client -u <YOUR_SMEE_URL_HERE> -t http://localhost:5173/api/github-webhook
```

> [!NOTE]
> You need to keep this terminal running while developing. Every time GitHub fires a webhook event, Smee will forward it to your local machine.

### How It Works Locally

When a webhook arrives at `http://localhost:5173/api/github-webhook`, it is handled by the `vite-plugin-vercel-mock.ts` plugin. This custom Vite plugin intercepts `/api/*` requests and routes them to the actual Vercel serverless function handlers (in the `api/` directory) directly inside the Vite dev server.

This means:
- ✅ You can use `npm run dev` — no need for `vercel dev` or the Vercel CLI
- ✅ The same `api/github-webhook.ts` handler runs locally and in production
- ✅ Environment variables from `.env.local` are loaded automatically by the plugin

> [!IMPORTANT]
> The webhook handler (`api/github-webhook.ts`) uses Supabase to broadcast real-time events to the browser. Make sure your Supabase environment variables are configured in `.env.local` before testing webhooks. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

---

## Production Environment (Vercel)

In production, GitHub delivers webhooks directly to your Vercel-hosted serverless function — no proxy needed.

### Webhook URL

Your production webhook URL is simply:

```
https://your-vercel-domain.app/api/github-webhook
```

Save this URL — you will paste it as the **Webhook URL** when creating your production GitHub App in [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md).