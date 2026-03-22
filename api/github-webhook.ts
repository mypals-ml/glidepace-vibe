import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (secret && signature) {
    const hmac = crypto.createHmac('sha256', secret);
    const body = JSON.stringify(req.body);
    const digest = 'sha256=' + hmac.update(body).digest('hex');

    if (signature !== digest) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const event = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`Received GitHub event: ${event}`);

  if (event === 'project_v2_item' || event === 'issues' || event === 'push') {
    const projectId = payload.project_v2_item?.project_node_id || payload.project_v2?.node_id;
    
    if (projectId) {
      // Use Supabase Realtime Broadcast
      const channel = supabase.channel(`project-${projectId}`);
      await channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: {
          message: 'Tasks updated on GitHub',
          timestamp: Date.now()
        }
      });
      console.log(`Broadcasted sync event for project: ${projectId}`);
    } else {
      const repoName = payload.repository?.full_name;
      if (repoName) {
        const channel = supabase.channel(`repo-${repoName.replace(/\//g, '-')}`);
        await channel.send({
          type: 'broadcast',
          event: 'sync',
          payload: {
            message: 'Repository updated',
            timestamp: Date.now()
          }
        });
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
