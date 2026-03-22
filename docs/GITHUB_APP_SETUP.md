# Setting up GitHub Apps for Glidelines

To provide the best user experience with automatic real-time sync, Glidelines uses a **GitHub App** instead of a standard OAuth App. This allows for zero-configuration webhooks—once a user installs the app, synchronization works automatically for all their projects.

To make local development seamless without constantly changing URLs in GitHub, you should create **two separate GitHub Apps**: one for Production and one for Local Testing.

---

## 🚀 1. Creating the Production App (`Glidelines`)

1. Go to your [GitHub Developer Settings -> GitHub Apps](https://github.com/settings/apps).
2. Click **New GitHub App**.

### Basic Information
*   **GitHub App name**: `Glidelines` (or similar)
*   **Description**: `Real-time Gantt charts for GitHub Projects`
*   **Homepage URL**: `https://your-vercel-domain.app`
*   **Callback URL**: `https://your-vercel-domain.app/api/github-oauth-callback`
*   **Request user authorization (OAuth) during installation**: `Checked` (Required to map the user back to the app immediately)

### Webhook
*   **Active**: `Checked`
*   **Webhook URL**: `https://your-vercel-domain.app/api/github-webhook`
*   **Webhook secret**: Generete a long, secure random string (Save this as `GITHUB_WEBHOOK_SECRET` in Vercel).

### Repository Permissions
Set the following to **Read & Write**:
*   `Issues`
*   `Projects (v2)`
Set the following to **Read-only**:
*   `Metadata` (Mandatory for all apps)

### Organization Permissions
Set the following to **Read & Write**:
*   `Projects (v2)`

### Subscribe to events
Check the following boxes:
*   `Issues`
*   `Project v2`
*   `Project v2 item`

### Where can this GitHub App be installed?
*   Select **Any account** (So other users/organizations can install it).

### Finish Setup
1. Click **Create GitHub App**.
2. On the next page, note down your **Client ID**.
3. Click **Generate a new client secret** and copy it. Add this to your Vercel Environment Variables.
4. (Optional but recommended) Upload a logo!

---

## 💻 2. Creating the Local Dev App (`Glidelines (Local)`)

Follow the exact same steps as above, but with the following changes designed for `localhost`:

### Basic Information (Local)
*   **GitHub App name**: `Glidelines (Local)`
*   **Homepage URL**: `http://localhost:5173`
*   **Callback URL**: `http://localhost:5173/api/github-oauth-callback`

### Webhook (Local)
Since GitHub cannot send webhooks to `localhost`, you need a proxy. We recommend [Smee.io](https://smee.io/).
1. Go to `https://smee.io/` and click "Start a new channel".
2. Copy the "Webhook Proxy URL".
*   **Webhook URL**: Paste your Smee URL here.
*   **Webhook secret**: Set a simple secret (e.g., `local_dev_secret`).

### Finish Setup (Local)
1. Generate the Client Secret as you did for Production.
2. Note the "Public link" URL on the app's settings page (e.g., `https://github.com/apps/glidelines-local`). You will need this for the "Install App" button.

---

## ⚙️ 3. Environment Variables

Your frontend and backend code expects these variables. 

Add these to your **Vercel Project Settings** for Production:
```env
# User Auth (Production)
VITE_GITHUB_CLIENT_ID=<Your Production App Client ID>
GITHUB_CLIENT_SECRET=<Your Production App Client Secret>

# Webhooks & Sync (Production)
GITHUB_WEBHOOK_SECRET=<Your Production Webhook Secret>
VITE_GITHUB_APP_INSTALL_URL=<Your Production App Public Link>
```

Add these to your root `.env.local` file for Local Development:
```env
# User Auth (Local)
VITE_GITHUB_CLIENT_ID=<Your Local App Client ID>
GITHUB_CLIENT_SECRET=<Your Local App Client Secret>

# Webhooks & Sync (Local)
GITHUB_WEBHOOK_SECRET=<Your Local Webhook Secret>
VITE_GITHUB_APP_INSTALL_URL=<Your Local App Public Link>
```

---

## 🔄 4. Running Webhooks Locally

To actually receive the webhooks while running `npm run dev`, you need to forward them from Smee to your local server.

In a separate terminal window, run:
```bash
npx smee-client -u <YOUR_SMEE_URL_HERE> -t http://localhost:5173/api/github-webhook
```
This will listen to the Smee URL provided to GitHub and proxy the POST requests directly to your local Vite server!
