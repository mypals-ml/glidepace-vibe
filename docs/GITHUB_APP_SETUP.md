# Setting up the GitHub App (for Webhooks and Auto-Sync)

Glidelines uses a **Dual Architecture**:
1. **OAuth App:** Used for User Login and data fetching (See [GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md)).
2. **GitHub App:** Used *strictly* to provide zero-configuration webhooks. Once a user installs this app, background synchronization works automatically for all their projects.

This guide explains how to set up the **GitHub App** layer explicitly to route background webhooks.

To make local development seamless, you should create **two separate GitHub Apps**: one for Production and one for Local Testing.

---

## 🚀 1. Creating the Production Webhook App

1. Go to your [GitHub Developer Settings -> GitHub Apps](https://github.com/settings/apps).
2. Click **New GitHub App**.

### Basic Information
*   **GitHub App name**: `Glidelines Sync` (or similar)
*   **Description**: `Auto-sync webhooks for Glidelines Gantt charts`
*   **Homepage URL**: `https://your-vercel-domain.app`
*   **Callback URL**: `https://your-vercel-domain.app` (Not critically used by this app, as OAuth handles login)
*   **Request user authorization (OAuth) during installation**: `Unchecked` (OAuth is handled by your other app)

### Webhook
*   **Active**: `Checked`
*   **Webhook URL**: `https://your-vercel-domain.app/api/github-webhook`
*   **Webhook secret**: Generate a long, secure random string (Save this as `GITHUB_WEBHOOK_SECRET` in `.env.local`).

### Repository Permissions
Set the following to **Read & Write**:
*   `Issues`
*   `Projects (v2)`
Set the following to **Read-only**:
*   `Metadata` (Mandatory for all apps)

### Organization Permissions
Set the following to **Read & Write**:
*   `Projects (v2)`
Set the following to **Read-only**:
*   `Members`

### Subscribe to events
Check the following boxes:
*   `Issues`
*   `Project v2`
*   `Project v2 item`

### Where can this GitHub App be installed?
*   Select **Any account** (So other users/organizations can install it).

### Finish Setup
1. Click **Create GitHub App**.
2. Note the "Public link" URL on the app's settings page (e.g., `https://github.com/apps/glidelines-sync`). You will need this for the `VITE_GITHUB_APP_INSTALL_URL` variable.

---

## 💻 2. Creating the Local Dev App

Follow the exact same steps as above, but with the following changes designed for `localhost`:

### Webhook (Local)
Since GitHub cannot send webhooks to `localhost`, you need a proxy. We recommend [Smee.io](https://smee.io/).
1. Go to `https://smee.io/` and click "Start a new channel".
2. Copy the "Webhook Proxy URL".
*   **Webhook URL**: Paste your Smee URL here.
*   **Webhook secret**: Set a simple secret (e.g., `local_dev_secret`).

> [!NOTE]
> You will need to run the `smee-client` in a separate terminal to forward these webhooks to your local server.
>
> **Example:**
> ```bash
> npx smee-client -u <YOUR_SMEE_URL_HERE> -t http://localhost:5173/api/github-webhook
> ```

---

## ⚙️ 3. Configure Environment Variables

Your frontend and backend code expects these variables for the Webhook App.

### Local Development Environment (Base64)
To avoid issues with multi-line strings in `.env.local`, we recommend encoding your `.pem` key as a **Base64 string**.

1. Run this command in your terminal (replace `your-app.private-key.pem` with your filename):
   ```bash
   base64 -i your-app.private-key.pem | tr -d '\n'
   ```
2. Copy the resulting long string.
3. Add these to your local `.env.local` file:
```env
# 2. GitHub App (Background Webhooks & Verification)
GITHUB_WEBHOOK_SECRET=<Your Local Webhook Secret>
VITE_GITHUB_APP_INSTALL_URL=<Your Local App Public Link>

# These are uniquely required to securely verify if the user installed the app correctly via the backend API:
GITHUB_APP_ID=<Your Local App numeric ID, e.g. 123456>
GITHUB_APP_PRIVATE_KEY="<Your Long Base64 String Here>"
```

### Production Environment (Vercel)
In Vercel, you can either paste the Base64 string (same as above) or paste the **Raw PEM content**. Vercel's UI usually handles the conversion of newlines automatically.

Add these identically-named but Live-valued keys to your **Vercel Project Settings -> Environment Variables**:
```env
# 2. GitHub App (Background Webhooks & Verification)
GITHUB_WEBHOOK_SECRET=<Your Production Webhook Secret>
VITE_GITHUB_APP_INSTALL_URL=<Your Production App Public Link>

GITHUB_APP_ID=<Your Production App numeric ID>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIICXAIBAAKBgQC...\n-----END RSA PRIVATE KEY-----"
```

> **Note:** The OAuth Client IDs/Secrets (used for user login) are handled explicitly by the separate OAuth App configurations. You do not need the Client ID or Client Secret from this specific GitHub App!
