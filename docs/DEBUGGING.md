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

### Debugging the UI
- **React DevTools:** Install the [React Developer Tools](https://react.dev/learn/react-developer-tools) browser extension. It allows you to deeply inspect the Component tree, view props (like the Dummy Data in the Gantt Chart), and force state/theme changes.
- **Console & Network:** Use Chrome/Firefox DevTools (F12) to monitor standard `console.log` outputs and watch for failed GraphQL network requests (once GitHub integration is live).
- **Tailwind v4:** If styles aren't appearing correctly, ensure you are running through Vite. Tailwind v4 compiles entirely via the `@tailwindcss/vite` plugin and does not require a standalone watcher.

## 2. Testing Logic (Vitest)
For complex business logic—specifically the core date math for the Gantt chart—we use Vitest.

1. **Run Tests Once:** `npm run test` (or `npx vitest`)
2. **Watch Mode:** `npm run test --watch` to continuously run tests in the background while you write pure functions.

## 3. API & Webhook Debugging (Vite Middleware)
Since Glidelines implements a serverless architecture, we use a custom Vite plugin to simulate the production API environment locally.

*   **Vite Plugin:** `vite-plugin-vercel-mock.ts` intercepts `/api/*` requests and routes them to your serverless functions in the `api/` directory.
*   **Webhook Simulation:** Use Smee.io to forward real GitHub webhooks to `http://localhost:5173/api/github-webhook` while `npm run dev` is active.

## 4. Mobile Device Debugging (Capacitor)
Since this is a Capacitor project, the web app is instantly wrappable for native iOS/Android deployment.

1. **Sync Web Build:** Run `npm run build && npx cap sync` to compile the TypeScript payload and hand it over to the native iOS/Android wrapper folders.
2. **iOS Debugging:** Run `npx cap open ios` to launch Xcode. You can use Safari's advanced Web Inspector to attach to the simulated iOS device and debug the web view directly.
3. **Android Debugging:** Run `npx cap open android` to launch Android Studio. You can use Chrome's `chrome://inspect/#devices` page to debug the WebView natively.
