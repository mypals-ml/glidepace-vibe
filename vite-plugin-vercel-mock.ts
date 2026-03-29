import { loadEnv } from 'vite';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import callbackHandler from './api/github-oauth-callback';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import checkAppInstallationHandler from './api/check-github-app-installation';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import webhookHandler from './api/github-webhook';

export default function vitePluginVercelMock() {
  return {
    name: 'vite-plugin-vercel-mock',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        console.log(`[ViteMock] Incoming request: ${req.method} ${req.url}`);
        const handledRoutes = [
          '/api/github-oauth-callback',
          '/api/check-github-app-installation',
          '/api/github-webhook'
        ];

        if (handledRoutes.some(route => req.url?.startsWith(route))) {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);

            // 1. Polyfill req.query (Vercel provides this natively)
            req.query = Object.fromEntries(url.searchParams);

            // 2. Polyfill req.body for POST requests (Vercel provides this natively as JSON)
            if (req.method === 'POST') {
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const rawBody = Buffer.concat(buffers).toString();
              (req as any).rawBody = rawBody; // Store raw body for signature verification
              try {
                req.body = JSON.parse(rawBody);
              } catch (e) {
                req.body = rawBody; // Fallback to string if not JSON
              }
            }

            // 3. Polyfill res.status and res.json (Vercel provides these natively)
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data: any) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
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
            if (req.url?.startsWith('/api/github-oauth-callback')) {
              return await callbackHandler(req, res);
            } else if (req.url?.startsWith('/api/check-github-app-installation')) {
              return await checkAppInstallationHandler(req, res);
            } else if (req.url?.startsWith('/api/github-webhook')) {
              return await webhookHandler(req, res);
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
