# Vercel Local Server setup

> [!NOTE]
> **Optional for this project:** We have created a `vite-plugin-vercel-mock.ts` which proxies these serverless functions directly within `npm run dev`! You can comfortably use `npm run dev` and ignore `vercel dev` entirely for local testing. However, the Vercel CLI instructions are left here for standard Vercel operations.

Glidelines heavily utilizes **Vercel Serverless Functions** in the `api/` directory for secure operations, including exchanging OAuth access tokens and checking backgrounds app installations using private keys.

Because these files run in a Node.js edge/lambda environment and not inside the browser, Vercel natively expects you to run `vercel dev`.

## 1. Install the Vercel CLI
If you haven't already, install the Vercel CLI globally::

```bash
npm i -g vercel
```

## 2. Link your Local Project to Vercel
Link your current repository to your provisioned Vercel project environment.

```bash
vercel link
```
Follow the prompts to connect it to your proper Vercel team and repository.

## 3. Pull Environment Variables
Rather than painstakingly updating `.env.local` every time you add a new key in the Vercel Dashboard, you can dynamically pull them down:

```bash
vercel env pull .env.local
```
This ensures your `GITHUB_APP_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and others are all identically matched.

> [!WARNING]
> Your `.env.local` is included in `.gitignore` by default. **NEVER** commit `.env.local` or your private keys to git!

## 4. Run the Dev Environment (Local)

Instead of using `npm run dev` directly to spin up the React frontend, run:

```bash
vercel dev
```

This brilliant command does two things simultaneously:
1. It looks at your `package.json` and runs the `dev` script (Vite) on a hidden proxy port.
2. It launches an emulation of Vercel Serverless Functions locally for every file in your `api/` folder.
3. It exposes everything cleanly on `http://localhost:3000`.

### Troubleshooting Access
When testing OAuth locally, always use the URL provided by Vercel Dev (e.g., `http://localhost:3000`), NOT the direct Vite URL (`http://localhost:5173`). Otherwise, `/api/...` network calls will fail with a 404 because Vite is serving the files, not the Vercel edge runtime proxy!

---

## 5. Deploying to Production

When you are ready to deploy your application to the public internet:

1. **Commit and Push:** Ensure all your code is pushed to your linked GitHub repository.
2. **Vercel Dashboard:** Because you linked your project in Step 2, Vercel will automatically trigger a deployment whenever you push to your `main` branch.
3. **Environment Variables:** Before your live deployment can function correctly, you **must** configure your Production Environment Variables. 
   - Go to your Vercel Dashboard -> Project -> **Settings** -> **Environment Variables**.
   - You must manually input all **Production** values outlined in the other setup guides (`GITHUB_OAUTH_SETUP.md`, `GITHUB_APP_SETUP.md`, `SUPABASE_SETUP.md`).

> [!IMPORTANT]
> Do not skip adding the Environment Variables in the Vercel dashboard. Production deployments do NOT read from your `.env.local` file. They strictly read from the Vercel dashboard settings!
