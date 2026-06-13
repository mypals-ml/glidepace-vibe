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

  type SyncType = 'sync' | 'refresh_task' | 'reorder';

  const PROJECT_V2_ITEM_CONFIG: Record<string, SyncType> = {
    'created': 'sync',
    'edited': 'refresh_task',
    'deleted': 'sync',
    'converted': 'refresh_task',
    'archived': 'refresh_task',
    'restored': 'refresh_task',
    'reordered': 'reorder',
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

  if (event === 'projects_v2_item' || event === 'project_v2_item') {
    syncType = PROJECT_V2_ITEM_CONFIG[action] || 'sync'; // Fallback to full sync for unknown actions
  } else if (event === 'issues') {
    syncType = ISSUE_CONFIG[action] || 'sync'; // Fallback to full sync for unknown actions
  } else if (event === 'push' || event === 'projects_v2' || event === 'project_v2') {
    syncType = 'sync'; // Always full sync for structural repo/project changes
  }

  if (syncType) {
    const projectId = payload.projects_v2_item?.project_node_id || payload.project_v2_item?.project_node_id || payload.projects_v2?.node_id || payload.project_v2?.node_id;
    const itemId = payload.projects_v2_item?.node_id || payload.project_v2_item?.node_id;
    const contentId = payload.projects_v2_item?.content_node_id || payload.project_v2_item?.content_node_id || payload.issue?.node_id;
    const deliveryId = (req.headers['x-github-delivery'] as string) || undefined;

    // Construct broadcast data. One payload (and one timestamp) is shared by
    // all channels so clients can fingerprint redundant broadcasts of the
    // same delivery. `message` is kept for backward compatibility.
    const broadcastPayload = {
      deliveryId,
      sourceEvent: event,
      action,
      projectId,
      itemId,
      contentId,
      timestamp: Date.now(),
      ...(syncType === 'sync' ? { message: 'Tasks updated on GitHub' } : {})
    };

    // Wait a bit for GitHub API eventual consistency before ANY broadcast,
    // including issue events that carry no projectId.
    const delay = syncType === 'sync' ? 2000 : 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // INDEPENDENT BROADCASTS: Reach the client via all applicable channels
    // 1. Project Channel (Specific to the project board)
    if (projectId) {
      const channelLabel = `project-${projectId}`;
      const channel = supabase.channel(channelLabel);

      const status = await channel.send({
        type: 'broadcast',
        event: syncType,
        payload: broadcastPayload
      });
      
      console.log(`[Webhook] Broadcasted ${syncType} to ${channelLabel}, status: ${status}`);
    }

    // 2. Repo Channel (Redundant fallback for issues/PRs linked to a repo)
    const repoName = payload.repository?.full_name;
    if (repoName) {
      const channelLabel = `repo-${repoName.replace(/\//g, '-')}`;
      const channel = supabase.channel(channelLabel);
      
      const status = await channel.send({
        type: 'broadcast',
        event: syncType,
        payload: broadcastPayload
      });
      
      console.log(`[Webhook] Redundant broadcast ${syncType} to ${channelLabel}, status: ${status}`);
    }

    // 3. Organization/User Channel (Top-level fallback)
    const ownerLogin = payload.organization?.login || payload.sender?.login;
    if (ownerLogin) {
      const channelLabel = `owner-${ownerLogin}`;
      const channel = supabase.channel(channelLabel);
      
      await channel.send({
        type: 'broadcast',
        event: syncType,
        payload: { ...broadcastPayload, projectId } // Include projectId so client knows if it's for them
      });
      
      console.log(`[Webhook] Broadcasted ${syncType} to ${channelLabel}`);
    }

    if (!projectId && !repoName) {
      console.warn(`[Webhook] No destination channel found (no projectId or repoName) for event: ${event}`);
    }
  } else {
    console.log(`[Webhook] Event or action ignored: ${event}.${action}`);
  }

  return res.status(200).json({ status: 'ok' });
}
