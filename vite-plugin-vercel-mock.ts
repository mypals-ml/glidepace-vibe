export default function vitePluginVercelMock() {
  return {
    name: 'vite-plugin-vercel-mock',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/github-oauth-callback')) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const code = url.searchParams.get('code');
          if (!code) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing code parameter' }));
          }

          try {
            const clientId = process.env.VITE_GITHUB_CLIENT_ID;
            const clientSecret = process.env.GITHUB_CLIENT_SECRET;

            const response = await fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
              }),
            });

            const data = await response.json();
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            if (data.error) {
              return res.end(JSON.stringify({ error: data.error_description || data.error }));
            }
            return res.end(JSON.stringify({ access_token: data.access_token }));
          } catch (err: any) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: 'Failed to exchange token with GitHub.' }));
          }
        }
        next();
      });
    },
  };
}
