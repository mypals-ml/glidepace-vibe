import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { login } = req.query;

  if (!login || typeof login !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid login parameter' });
  }

  if (!appId || !privateKey) {
    console.warn('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 10 * 60,
      iss: appId
    };
    
    // Format private key: Supports Base64 (recommended for env vars) or Raw PEM (with escaped \n)
    let formattedPrivateKey = privateKey.trim();
    if (!formattedPrivateKey.startsWith('---')) {
      // If it doesn't look like a PEM key, assume it's Base64
      try {
        formattedPrivateKey = Buffer.from(formattedPrivateKey, 'base64').toString('utf8');
      } catch (e) {
        // Fallback to raw if decoding fails
        formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      }
    } else {
      // If it is a PEM key, just fix literal backslashes from env managers
      formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
    }
    
    const token = jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });

    // Try checking if it's installed for a user account first
    let githubRes = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/installation`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glidepace-Vibe-App'
      }
    });

    if (githubRes.ok) {
      return res.status(200).json({ installed: true });
    }

    if (githubRes.status === 404) {
      // Fall back to checking if it's an organization account
      githubRes = await fetch(`https://api.github.com/orgs/${encodeURIComponent(login)}/installation`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Glidepace-Vibe-App'
        }
      });

      if (githubRes.ok) {
        return res.status(200).json({ installed: true });
      }
      
      if (githubRes.status === 404) {
        return res.status(200).json({ installed: false });
      }
    }

    // Handles rate limits, timeouts, or 403s
    const errorText = await githubRes.text();
    console.error('GitHub API check failed', githubRes.status, errorText);
    return res.status(githubRes.status).json({ error: 'Failed to verify installation' });

  } catch (error: any) {
    console.error('Check App Installation Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
