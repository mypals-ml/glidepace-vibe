# Glidelines Production Deployment Guide

Welcome to the Glidelines live deployment map! 

To successfully push your code to the public internet on Vercel, you need to configure a dual-app architecture (using Production GitHub apps to protect your local test environments), explicitly link a live real-time database, and properly populate your serverless Vercel Dashboard secrets.

Please complete the following documentation steps sequentially, focusing *strictly* on their **Production Environment** sections, to guarantee a working live deployment:

## 1. Supabase Database Configuration (Production)
Because Supabase provides isolated environments, you must create a dedicated project for Production so live webhook logs do not clash with your local `localhost` testing data.

👉 **Start Here:** [Read SUPABASE_SETUP.md](./SUPABASE_SETUP.md) (Follow the Production Environment rules)

## 2. GitHub OAuth App Setup (Production)
Used strictly for user login. You must create a completely separate GitHub OAuth app to protect your local testing URLs and explicitly route them to your *live Vercel domain* (e.g., `https://your-app.vercel.app`).

👉 **Next Step:** [Read GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md) (Follow the Production OAuth App rules)

## 3. GitHub Background Sync App Setup (Production)
Because we do not use OAuth for webhooks, you need to create a dedicated **GitHub App** for live data. Instead of routing through `smee.io`, you must point it directly to your Vercel URL payload endpoints.

👉 **Next Step:** [Read GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) (Follow the Production Webhook App rules)

## 4. Vercel Target Deployment
Once your GitHub remote repository is linked to Vercel, Vercel will attempt to build and deploy your live code. Before the public can successfully use the app securely, you MUST implement all 10 environment variables gathered from Steps 1-3 into the Vercel Settings Dashboard.

👉 **Final Step:** [Read VERCEL_SETUP.md](./VERCEL_SETUP.md) (Follow the Deploying to Production rules)

---

### Final Verification 🚀
Once all environment variables are saved in Vercel:
1.  Go to the **Deployments** tab in Vercel and trigger a **Redeploy**.
2.  Open your live URL.
3.  Click "Login with GitHub" to test the OAuth flow across the domain.
4.  Open the "Open Projects" dialog. Click "Install App" to complete the GitHub setup flow. The banner should cleanly disappear locally and stay gone, signaling that your Vercel backend verification API is working perfectly in Production!
