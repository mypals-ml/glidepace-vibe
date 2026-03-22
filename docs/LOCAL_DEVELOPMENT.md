# Glidelines Local Development Environment Guide

Welcome to the Glidelines developer onboarding map! 

To get your local environment fully operational, you need to configure a dual-app architecture (for both login and background syncing), link a real-time database, and run a serverless engine proxy.

Please complete the following documentation steps sequentially to guarantee a working `localhost` setup:

## 1. Supabase Database Configuration
Because Gantt charts rely on real-time broadcast channels for webhook updates, you need to configure a Supabase project first to acquire your API keys and Service Roles.

👉 **Start Here:** [Read SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## 2. GitHub OAuth App Setup
To allow users to log into your local environment securely and grant permission to read their repository/project data, you must create a GitHub **OAuth App** specifically for your `localhost` callback URLs.

👉 **Next Step:** [Read GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md)

## 3. GitHub Background Sync App Setup
Because we do not use OAuth for webhooks (to keep user permissions explicit), you need to create a dedicated **GitHub App**. This app handles background triggers (like creating an Issue) and secure backend API checks (via Private Keys). You will route these local webhooks using a proxy like Smee.io.

👉 **Next Step:** [Read GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md)

## 4. Vercel Serverless Development
Since Glidelines uses secure backend APIs (`api/github-oauth-callback`, `api/check-github-app-installation`, etc.), running `npm run dev` directly via Vite isn't enough. You must use the Vercel CLI to spin up a hybrid environment that hosts both the frontend UI and the serverless functions simultaneously.

👉 **Final Step:** [Read VERCEL_SETUP.md](./VERCEL_SETUP.md)

---

### Need to Debug?
If you've followed the steps above and are still encountering CORS errors, OAuth loop failures, or Webhook permission denied issues, consult the debugging manifest:
👉 [Read DEBUGGING.md](./DEBUGGING.md)
