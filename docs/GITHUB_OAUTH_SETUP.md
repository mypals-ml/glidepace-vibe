# GitHub OAuth Setup Guide

This document outlines the architecture and setup process for implementing a secure GitHub OAuth flow in Glidelines, utilizing Vercel's serverless functions.

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
   - **Authorization callback URL:** `http://localhost:5173/api/callback`
4. Generate a **Client Secret**.
5. Save the `Client ID` and `Client Secret` in a `.env.local` file in the project root:
   ```env
   VITE_GITHUB_CLIENT_ID=your_local_client_id
   GITHUB_CLIENT_SECRET=your_local_client_secret
   ```

### Production OAuth App
1. Create a second OAuth App named `Glidelines`.
2. Set the details:
   - **Homepage URL:** `https://glidelines.vercel.app`
   - **Authorization callback URL:** `https://glidelines.vercel.app/api/callback`
   - **Application description:** `A modern, reactive Gantt chart dashboard for visualizing and managing GitHub project timelines, dependencies, and issues in real-time.`
3. Generate a **Client Secret** for this production app.

## 2. Create the Secure Vercel Function

Vercel allows us to write serverless functions in an `api/` directory at the root of the project. 

The `api/callback.ts` function will:
1. Receive the temporary `code` from GitHub via the URL query parameters after the user authorizes.
2. Make a secure server-to-server `POST` request to `https://github.com/login/oauth/access_token` using the `code`, `Client ID`, and the hidden `GITHUB_CLIENT_SECRET` environment variable.
3. Receive the permanent `access_token` from GitHub.
4. Redirect the user back to the main frontend application (`/`), passing the token securely so the React app can store it in browser `localStorage`.

## 3. Display the Project Selector UI

Once the React frontend securely receives and saves the `access_token`:
1. The UI checks if a GitHub Project is already selected.
2. If no project is selected, the frontend makes an authenticated request to the GitHub GraphQL API to fetch a list of all `ProjectsV2` associated with the authenticated user or organization.
3. An overlay modal is triggered, prompting the user to *"Select a GitHub Project"*.
4. The user selects a project from the dropdown.
5. The selected Project ID is stored, and the Gantt chart boots up sequentially, fetching the real issue timeline data.

## 4. Deploy and Connect the OAuth App via Vercel

When deploying to Vercel, you need to securely inject the Production OAuth App secrets into the build environment.

1. Go to your project on the [Vercel Dashboard](https://vercel.com/dashboard).
2. Navigate to **Settings** -> **Environment Variables**.
3. Add the following keys using the values from your **Production OAuth App**:
   - `VITE_GITHUB_CLIENT_ID` (Value: your production client ID)
   - `GITHUB_CLIENT_SECRET` (Value: your production client secret)
4. Trigger a redeployment if necessary.
5. Once deployed, the live Vercel application will use the Production OAuth app, protecting your secrets and ensuring the `api/callback` route fires securely.
