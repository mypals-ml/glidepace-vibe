# GitHub OAuth Setup Guide

This document outlines the architecture and setup process for implementing a secure GitHub OAuth flow in Glidelines, utilizing Vercel's serverless functions. 

Because we use a **Dual Architecture**, this Classic OAuth App is solely responsible for logging the user in and fetching their project lists natively without API blockers.

## Overview

Because Glidelines is a client-side React application, securely exchanging an OAuth code for an access token requires a backend layer (to avoid exposing the Client Secret to the browser). We use Vercel Serverless Functions to handle this securely.

## 1. Set up a GitHub OAuth App

> **Best Practice:** Create **two** OAuth Apps—one for local development and one for production.

### Local Development OAuth App
1. Go to your GitHub Settings -> Developer settings -> OAuth Apps.
2. Click **New OAuth App**.
3. Set the details:
   - **Application name:** `Glidelines (Local)`
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:5173/api/github-oauth-callback`
4. Generate a **Client Secret**.
5. Save the `Client ID` and `Client Secret` as part of your **Local Environment Variables**:
   ```env
   # 1. OAuth App (Frontend Login & Data)
   VITE_GITHUB_OAUTH_CLIENT_ID=your_local_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_local_client_secret
   ```

### Production OAuth App
1. Create a second OAuth App named `Glidelines`.
2. Set the details:
   - **Homepage URL:** `https://glidelines.vercel.app`
   - **Authorization callback URL:** `https://glidelines.vercel.app/api/github-oauth-callback`
   - **Application description:** `A modern, reactive Gantt chart dashboard for visualizing and managing GitHub project timelines, dependencies, and issues in real-time.`
3. Generate a **Client Secret** for this production app.

4. To finalize the deployment:
   4.1. Go to your project on the [Vercel Dashboard](https://vercel.com/dashboard).
   4.2. Navigate to **Settings** -> **Environment Variables**. These are your **Production Environment Variables**.
   4.3. Add the following keys using the values from your **Production OAuth App**:
      - `VITE_GITHUB_OAUTH_CLIENT_ID` (Value: your production client ID)
      - `GITHUB_OAUTH_CLIENT_SECRET` (Value: your production client secret)
   4.4. Trigger a redeployment if necessary.
   4.5. Once deployed, the live environment will protect your secrets and ensure the `api/github-oauth-callback` route fires securely.

## How It Works
### 1. Create the Secure Callback Function

To securely trade the temporary OAuth code for an access token without exposing the secret to the browser, we need a backend endpoint. We write this as a generic serverless function located in the `api/` directory.

The `api/github-oauth-callback.ts` function will:
1. Receive the temporary `code` from GitHub via the URL query parameters after the user authorizes.
2. Make a secure server-to-server `POST` request to `https://github.com/login/oauth/access_token` using the `code`, `Client ID`, and the hidden `GITHUB_OAUTH_CLIENT_SECRET` environment variable.
3. Receive the permanent `access_token` from GitHub.
4. Redirect the user back to the main frontend application (`/`), passing the token securely so the React app can store it in browser `localStorage`.

### 2. Display the Project Selector UI

Once the React frontend securely receives and saves the `access_token`:
1. The UI checks if a GitHub Project is already selected.
2. If no project is selected, the frontend makes an authenticated request to the GitHub GraphQL API to fetch a list of all `ProjectsV2` associated with the authenticated user or organization.
3. Because we use a classic OAuth app token instead of a GitHub App user-to-server token, the fetch fully supports `viewer.projectsV2` for personal projects without any GitHub API permission errors.
4. An overlay modal is triggered, prompting the user to *"Select a GitHub Project"*.
5. The user selects a project from the dropdown.
6. The selected Project ID is stored, and the Gantt chart boots up sequentially, fetching the real issue timeline data.

### 3. Deploy and Connect the OAuth App via Vercel

Vercel features **Zero-Config Serverless Functions**. This means you do absolutely nothing to configure the backend API—just by placing `github-oauth-callback.ts` inside the `api/` folder, Vercel automatically detects it and deploys it as a standalone, secure AWS Lambda function mapped to `/api/github-oauth-callback`.
