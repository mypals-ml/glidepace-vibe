import { loadEnv } from 'vite';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import callbackHandler from './api/github-oauth-callback';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import checkAppInstallationHandler from './api/check-github-app-installation';

export default function vitePluginVercelMock() {
  return {
    name: 'vite-plugin-vercel-mock',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/github-oauth-callback') || req.url?.startsWith('/api/check-github-app-installation')) {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            
            // 1. Polyfill req.query (Vercel provides this natively)
            req.query = Object.fromEntries(url.searchParams);
            
            // 2. Polyfill res.status and res.json (Vercel provides these natively)
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data: any) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };

            // 3. Ensure process.env secrets are loaded for the external handler
            const env = loadEnv('', process.cwd(), '');
            process.env.VITE_GITHUB_OAUTH_CLIENT_ID = env.VITE_GITHUB_OAUTH_CLIENT_ID;
            process.env.GITHUB_OAUTH_CLIENT_SECRET = env.GITHUB_OAUTH_CLIENT_SECRET;
            process.env.GITHUB_APP_ID = env.GITHUB_APP_ID;
            process.env.GITHUB_APP_PRIVATE_KEY = env.GITHUB_APP_PRIVATE_KEY;
            
            // 4. Delegate completely to the real Vercel API route handler!
            if (req.url?.startsWith('/api/github-oauth-callback')) {
              return await callbackHandler(req, res);
            } else if (req.url?.startsWith('/api/check-github-app-installation')) {
              return await checkAppInstallationHandler(req, res);
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
