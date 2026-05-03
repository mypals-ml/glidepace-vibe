# Debugging & Development Guide

This guide covers how to run, test, and debug the Glidelines project across its different environments.

## 1. Local Web Development (Vite + React)
The easiest way to build and debug the UI is entirely through the web browser using the Vite development server.

### Environment Variables Setup
By pulling environment variables from Vercel, a .evn.local file will be created automatically.
Reference: https://vercel.com/docs/deployments/environments#local-development-environment

### Starting the Server
1. Ensure you are in the project root folder.
2. Install dependencies (if not done already): `npm install`
3. Start the Vite hot-reloading server: `npm run dev`
4. Open `http://localhost:5173` in your browser.

## 2. API & Webhook Debugging (Vite Middleware)

Since Glidelines implements a serverless architecture, we use a custom Vite plugin to simulate the production API environment locally. This allows you to test the `api/*.ts` functions without deploying to Vercel.

### Local Setup (Step-by-Step)
1.  **Vite Middleware:** The `vite-plugin-vercel-mock.ts` plugin intercepts `/api/*` requests and routes them to your serverless functions in the `api/` directory. No special command is needed beyond `npm run dev`.
2.  **Smee Proxy:** GitHub cannot reach `localhost`. You must run a Smee client to forward real GitHub webhooks to your local machine:
    ```bash
    npx smee-client -u <YOUR_SMEE_URL> -t http://localhost:5173/api/github-webhook
    ```
3.  **GitHub App Config:** Ensure your "Local Test" GitHub App's **Webhook URL** is set to your Smee URL.

### "Why is my app updating without Smee?"
If you see real-time updates in your local browser even when Smee is **not** running, it's usually because:
- You have **two GitHub Apps** installed on your repository (e.g., a "Product App" and a "Local App").
- The **Product App** sends webhooks to the live **Vercel** server.
- The Vercel server broadcasts the event to **Supabase**.
- Your local browser is connected to the same **Supabase project** and hears the broadcast.

> [!IMPORTANT]
> To debug **local changes** to the webhook code (`api/github-webhook.ts`), you **must** use Smee. Otherwise, you are just watching the production server handle the events!

### Verification
- Check the **Browser Console** for `[DashboardSync]` logs to see events being received.
- Check the **Terminal** where `npm run dev` is running to see `[Webhook]` logs from the server-side code.

## 3. Mock Mode (Developing without GitHub API)
If you don't want to configure real GitHub OAuth or webhooks locally, you can use the built-in mock mode. This simulates the entire GitHub GraphQL API and provides pre-configured mock accounts.

1.  **Start Mock Server:** `npm run dev:test`
2.  **Auto-login:** The app will automatically connect as the "Octocat" user.
3.  **Behavior:** All actions (dragging tasks, editing titles, adding comments) are handled by `src/lib/githubMock.ts` and persist during your active session.

### Debugging the UI
- **React DevTools:** Install the [React Developer Tools](https://react.dev/learn/react-developer-tools) browser extension. It allows you to deeply inspect the Component tree, view props, and force state/theme changes.
- **Console & Network:** Use Chrome/Firefox DevTools (F12) to monitor standard `console.log` outputs and watch for failed GraphQL network requests (once GitHub integration is live).
- **Tailwind v4:** If styles aren't appearing correctly, ensure you are running through Vite. Tailwind v4 compiles entirely via the `@tailwindcss/vite` plugin and does not require a standalone watcher.

## 4. Testing Logic (Vitest)
For complex business logic—specifically the core date math for the Gantt chart—we use Vitest.

1. **Run Tests Once:** `npm run test` (or `npx vitest`)
2. **Watch Mode:** `npm run test --watch` to continuously run tests in the background while you write pure functions.

## 5. Mobile Device Debugging (Capacitor)
Since this is a Capacitor project, the web app is instantly wrappable for native iOS/Android deployment.

1. **Sync Web Build:** Run `npm run build && npx cap sync` to compile the TypeScript payload and hand it over to the native iOS/Android wrapper folders.
2. **iOS Debugging:** Run `npx cap open ios` to launch Xcode. You can use Safari's advanced Web Inspector to attach to the simulated iOS device and debug the web view directly.
3. **Android Debugging:** Run `npx cap open android` to launch Android Studio. You can use Chrome's `chrome://inspect/#devices` page to debug the WebView natively.
