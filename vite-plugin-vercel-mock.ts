import { IncomingMessage, ServerResponse } from 'http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadEnv } from 'vite';
import callbackHandler from './api/github-oauth-callback';
import checkAppInstallationHandler from './api/check-github-app-installation';
import webhookHandler from './api/github-webhook';

export default function vitePluginVercelMock() {
  return {
    name: 'vite-plugin-vercel-mock',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url || '';
        const augmentedReq = req as IncomingMessage & { query: Record<string, string>, body: Record<string, unknown> | string, cookies: Record<string, string>, rawBody?: string };
        const augmentedRes = res as ServerResponse & { status: (c: number) => ServerResponse, json: (d: unknown) => void };

        console.log(`[ViteMock] Incoming request: ${req.method} ${reqUrl}`);
        const handledRoutes = [
          '/api/github-oauth-callback',
          '/api/check-github-app-installation',
          '/api/github-webhook'
        ];

        if (handledRoutes.some(route => reqUrl.startsWith(route))) {
          try {
            const url = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);

            // 1. Polyfill req.query (Vercel provides this natively)
            augmentedReq.query = Object.fromEntries(url.searchParams);
            augmentedReq.cookies = {}; // Mock cookies

            // 2. Polyfill req.body for POST requests (Vercel provides this natively as JSON)
            if (req.method === 'POST') {
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const rawBody = Buffer.concat(buffers).toString();
              augmentedReq.rawBody = rawBody; // Store raw body for signature verification
              try {
                augmentedReq.body = JSON.parse(rawBody);
              } catch {
                augmentedReq.body = rawBody; // Fallback to string if not JSON
              }
            }

            // 3. Polyfill res.status and res.json (Vercel provides these natively)
            augmentedRes.status = (code: number) => {
              augmentedRes.statusCode = code;
              return augmentedRes;
            };
            augmentedRes.json = (data: unknown) => {
              augmentedRes.setHeader('Content-Type', 'application/json');
              augmentedRes.end(JSON.stringify(data));
            };

            // 4. Ensure process.env secrets are loaded for the external handler
            const env = loadEnv('', process.cwd(), '');
            process.env.VITE_GITHUB_OAUTH_CLIENT_ID = env.VITE_GITHUB_OAUTH_CLIENT_ID;
            process.env.GITHUB_OAUTH_CLIENT_SECRET = env.GITHUB_OAUTH_CLIENT_SECRET;
            process.env.GITHUB_APP_ID = env.GITHUB_APP_ID;
            process.env.GITHUB_APP_PRIVATE_KEY = env.GITHUB_APP_PRIVATE_KEY;
            process.env.GITHUB_APP_WEBHOOK_SECRET = env.GITHUB_APP_WEBHOOK_SECRET;
            process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
            process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

            // 5. Delegate completely to the real Vercel API route handler!
            if (reqUrl.startsWith('/api/github-oauth-callback')) {
              return await callbackHandler(augmentedReq as unknown as VercelRequest, augmentedRes as unknown as VercelResponse);
            } else if (reqUrl.startsWith('/api/check-github-app-installation')) {
              return await checkAppInstallationHandler(augmentedReq as unknown as VercelRequest, augmentedRes as unknown as VercelResponse);
            } else if (reqUrl.startsWith('/api/github-webhook')) {
              return await webhookHandler(augmentedReq as unknown as VercelRequest, augmentedRes as unknown as VercelResponse);
            }

          } catch (err) {
            console.error('Vite Mock Server Error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: 'Local Dev Server Fault' }));
          }
        } else {
          next();
        }
      });
    },
  };
}
