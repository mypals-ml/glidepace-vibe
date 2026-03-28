# Glidelines Production Deployment Guide

Welcome to the Glidelines live deployment map! 🚀

To successfully push your code to the public internet on Vercel, you need to configure a dual-app architecture (using Production GitHub apps to protect your local test environments), link a real-time database, and properly populate your serverless Vercel Dashboard secrets.

Please complete the following documentation steps sequentially, focusing *strictly* on their **Production Environment** sections, to guarantee a working live deployment:

## 1. Supabase Database Configuration
Glidelines uses the same Supabase project for both local development and production — Realtime Broadcast channels are ephemeral and don't store persistent data.

👉 **Start Here:** [Read SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

> If you've already completed Supabase setup during local development, you can skip this step — just ensure the same keys are added to your Vercel environment variables.

## 2. GitHub OAuth App Setup (Production)
Used strictly for user login. You must create a completely separate GitHub OAuth app to protect your local testing URLs and explicitly route them to your *live Vercel domain* (e.g., `https://your-app.vercel.app`).

👉 **Next Step:** [Read GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md) (Follow the Production OAuth App section)

## 3. Webhook Setup (Production)
In production, GitHub delivers webhooks directly to your Vercel-hosted serverless function. This step also covers linking your GitHub repository to Vercel and configuring all environment variables in the Vercel Dashboard.

👉 **Next Step:** [Read WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) (Follow the Production Environment section)

> [!TIP]
> Have your Vercel domain URL ready before proceeding to the next step — you'll paste it as the webhook URL when creating your production GitHub App.

## 4. GitHub Background Sync App Setup (Production)
Because we do not use OAuth for webhooks, you need to create a dedicated **GitHub App** for live data. You'll point the webhook URL directly to your Vercel domain endpoint from Step 3.

👉 **Next Step:** [Read GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Follow the Production Webhook App section)

## 4. Link your GitHub repo to Vercel
- Go to the [Vercel Dashboard](https://vercel.com/dashboard).
- Click **Add New… → Project** and import your GitHub repository.
- Vercel will auto-detect the Vite framework and configure build settings.

## 5.  Final Verification

### 5.1. Configure Environment Variables:
   - Go to your Vercel project → **Settings** → **Environment Variables**.
   - Add **all** of the following keys (values come from the other setup guides):

   | Variable | Source |
   |---|---|
   | `VITE_GITHUB_OAUTH_CLIENT_ID` | [GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md) (Production OAuth App) |
   | `GITHUB_OAUTH_CLIENT_SECRET` | [GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md) (Production OAuth App) |
   | `GITHUB_APP_ID` | [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Production GitHub App) |
   | `GITHUB_APP_PRIVATE_KEY` | [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Production GitHub App) |
   | `VITE_GITHUB_APP_INSTALL_URL` | [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Production GitHub App) |
   | `GITHUB_WEBHOOK_SECRET` | [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Production GitHub App) |
   | `VITE_SUPABASE_URL` | [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
   | `VITE_SUPABASE_ANON_KEY` | [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
   | `SUPABASE_URL` | [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
   | `SUPABASE_SERVICE_ROLE_KEY` | [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |

> [!IMPORTANT]
> Production deployments do **NOT** read from your `.env.local` file. You must configure all environment variables in the Vercel Dashboard.

> [!WARNING]
> After adding or changing environment variables, trigger a **Redeploy** from the Deployments tab for changes to take effect.

### 5.2. Redeploy and Test 🚀
Once all environment variables are saved in Vercel:
1.  Go to the **Deployments** tab in Vercel and trigger a **Redeploy**.
  - Vercel automatically triggers a deployment whenever you push to your `main` branch.
2.  Open your live URL.
3.  Click "Login with GitHub" to test the OAuth flow across the domain.
4.  Open the "Open Projects" dialog. Click "Install App" to complete the GitHub setup flow. The banner should cleanly disappear locally and stay gone, signaling that your Vercel backend verification API is working perfectly in Production!

