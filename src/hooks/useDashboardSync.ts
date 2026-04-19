import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Task } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Manages Supabase real-time channel subscriptions for project/task sync.
 * Sync time state (lastSyncedTime, updateSyncTime, getSyncedTimeText) lives
 * in the provider to avoid circular deps between this hook and useDashboardTasks.
 */
export function useDashboardSync(deps: {
  selectedProjectId: string | null;
  githubToken: string;
  tasks: Task[];
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<void>;
}): void {
  const {
    selectedProjectId,
    githubToken,
    tasks,
    fetchProjectTasks,
    fetchSingleProjectItem,
  } = deps;

  useEffect(() => {
    if (!selectedProjectId || !supabase) return;

    const projectChannelLabel = `project-${selectedProjectId}`;
    const repoNames = Array.from(new Set(tasks.map(t => t.repository).filter(Boolean)));
    const repoChannelLabels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);

    const allChannels = [projectChannelLabel, ...repoChannelLabels];

    const activeChannels = allChannels.map(label => {
      const channel = supabase.channel(label);
      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProjectId) {
            fetchProjectTasks(selectedProjectId, githubToken);
          }
        })
        .on('broadcast', { event: 'refresh_task' }, (payload) => {
          const { itemId, contentId } = payload.payload || {};
          console.log(`[DashboardSync] Targeted Refresh RECEIVED on ${label}:`, { itemId, contentId });

          if (githubToken && itemId) {
            fetchSingleProjectItem(itemId, githubToken);
          } else if (githubToken && contentId) {
            const task = tasks.find(t => t.contentId === contentId);
            if (task && task.itemId) {
              fetchSingleProjectItem(task.itemId, githubToken);
            } else if (selectedProjectId) {
              fetchProjectTasks(selectedProjectId, githubToken);
            }
          } else if (githubToken && selectedProjectId) {
            fetchProjectTasks(selectedProjectId, githubToken);
          }
        })
        .subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [selectedProjectId, githubToken, fetchProjectTasks, tasks, fetchSingleProjectItem]);
}
