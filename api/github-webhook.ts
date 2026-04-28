import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    return res.status(500).json({ error: 'Server misconfiguration: Missing Supabase credentials.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  if (secret && signature) {
    const hmac = crypto.createHmac('sha256', secret);
    // Use rawBody if available (from mock server) to ensure signature matches
    const bodyString = (req as VercelRequest & { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const digest = 'sha256=' + hmac.update(bodyString).digest('hex');

    if (signature !== digest) {
      console.warn('Webhook signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // ========================================
  // Sync Configuration Tables
  // ========================================

  type SyncType = 'sync' | 'refresh_task';

  const PROJECT_V2_ITEM_CONFIG: Record<string, SyncType> = {
    'created': 'sync',
    'edited': 'refresh_task',
    'deleted': 'sync',
    'converted': 'refresh_task',
    'archived': 'refresh_task',
    'restored': 'refresh_task',
    'reordered': 'sync',
  };

  const ISSUE_CONFIG: Record<string, SyncType> = {
    'opened': 'sync',
    'edited': 'refresh_task',
    'deleted': 'sync',
    'transferred': 'sync',
    'pinned': 'refresh_task',
    'unpinned': 'refresh_task',
    'closed': 'refresh_task',
    'reopened': 'refresh_task',
    'assigned': 'refresh_task',
    'unassigned': 'refresh_task',
    'labeled': 'refresh_task',
    'unlabeled': 'refresh_task',
    'locked': 'refresh_task',
    'unlocked': 'refresh_task',
    'milestoned': 'refresh_task',
    'demilestoned': 'refresh_task',
    'sub_issues_added': 'sync',
    'sub_issues_removed': 'sync',
  };

  const event = req.headers['x-github-event'];
  const payload = req.body;
  const action = payload.action;

  console.log(`[Webhook] Received event: ${event}, action: ${action}`);

  // Determine sync requirement based on tables
  let syncType: SyncType | null = null;

  if (event === 'projects_v2_item') {
    syncType = PROJECT_V2_ITEM_CONFIG[action] || 'sync'; // Fallback to full sync for unknown actions
  } else if (event === 'issues') {
    syncType = ISSUE_CONFIG[action] || 'sync'; // Fallback to full sync for unknown actions
  } else if (event === 'push' || event === 'projects_v2') {
    syncType = 'sync'; // Always full sync for structural repo/project changes
  }

  if (syncType) {
    const projectId = payload.projects_v2_item?.project_node_id || payload.projects_v2?.node_id;

    // Construct broadcast data
    const broadcastPayload = syncType === 'refresh_task'
      ? {
        itemId: payload.projects_v2_item?.node_id,
        contentId: payload.projects_v2_item?.content_node_id || payload.issue?.node_id,
        timestamp: Date.now()
      }
      : {
        message: 'Tasks updated on GitHub',
        timestamp: Date.now()
      };

    if (projectId) {
      const channelLabel = `project-${projectId}`;
      const channel = supabase.channel(channelLabel);
      
      // For all sync events, wait a bit for GitHub API eventual consistency.
      // GitHub sometimes sends the webhook before the GraphQL API is fully updated.
      const delay = syncType === 'sync' ? 2000 : 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const status = await channel.send({
        type: 'broadcast',
        event: syncType,
        payload: broadcastPayload
      });
      
      console.log(`[Webhook] Broadcasted ${syncType} to ${channelLabel}, status: ${status}, payload:`, JSON.stringify(broadcastPayload));
    } else {
      const repoName = payload.repository?.full_name;
      if (repoName) {
        const channelLabel = `repo-${repoName.replace(/\//g, '-')}`;
        const channel = supabase.channel(channelLabel);
        
        const status = await channel.send({
          type: 'broadcast',
          event: syncType,
          payload: broadcastPayload
        });
        console.log(`[Webhook] Broadcasted ${syncType} to ${channelLabel}, status: ${status}`);
      }
    }
  } else {
    console.log(`[Webhook] Event or action ignored: ${event}.${action}`);
  }

  return res.status(200).json({ status: 'ok' });
}
