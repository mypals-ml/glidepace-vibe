import { GITHUB_OAUTH_ACCESS_TOKEN_URL } from '../src/lib/constants';

export default async function handler(req, res) {
  // Setup CORS just in case
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  const clientId = process.env.VITE_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing OAuth credentials in environment.');
    return res.status(500).json({ error: 'Server misconfiguration: Missing OAuth credentials.' });
  }

  try {
    const response = await fetch(GITHUB_OAUTH_ACCESS_TOKEN_URL, {
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

    if (data.error) {
      return res.status(400).json({ error: data.error_description || data.error });
    }

    // Fetch user profile info using the access token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glidepace-Vibe',
      },
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user profile', await userResponse.text());
      return res.status(500).json({ error: 'Failed to fetch user profile from GitHub.' });
    }

    const userData = await userResponse.json();

    const accountData = {
      id: userData.id.toString(),
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      token: data.access_token
    };

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(200).json({ 
        access_token: data.access_token,
        user: accountData
      });
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Authenticating...</title></head>
        <body>
          <script>
            const account = ${JSON.stringify(accountData)};
            const newAccount = {
              id: account.id,
              login: account.login,
              name: account.name,
              avatarUrl: account.avatar_url,
              token: account.token
            };
            let accounts = [];
            try {
              accounts = JSON.parse(localStorage.getItem('github_accounts') || '[]');
            } catch (e) {}
            const filtered = accounts.filter(a => a.id !== newAccount.id);
            filtered.push(newAccount);
            localStorage.setItem('github_accounts', JSON.stringify(filtered));
            localStorage.setItem('active_github_account_id', newAccount.id);
            window.location.href = '/';
          </script>
        </body>
      </html>
    `;
    
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'text/html');
    }
    if (typeof res.send === 'function') {
      return res.send(html);
    } else {
      return res.end(html);
    }
  } catch (error) {
    console.error('Failed to exchange code for token:', error);
    return res.status(500).json({ error: 'Failed to exchange token with GitHub.' });
  }
}
