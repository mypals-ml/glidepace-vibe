import { loadEnv } from 'vite';
// @ts-ignore - Ignore TS complaining about importing a file outside of root if applicable
import callbackHandler from './api/github-oauth-callback';

export default function vitePluginVercelMock() {
  return {
    name: 'vite-plugin-vercel-mock',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/github-oauth-callback')) {
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
            process.env.VITE_GITHUB_CLIENT_ID = env.VITE_GITHUB_CLIENT_ID;
            process.env.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
            
            // 4. Delegate completely to the real Vercel API route handler!
            return await callbackHandler(req, res);
            
          } catch (err) {
            console.error('Vite Mock Server Error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: 'Local Dev Server Fault' }));
          }
        }
        next();
      });
    },
  };
}
