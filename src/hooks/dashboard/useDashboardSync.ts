import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Task } from '../../types';

interface UseDashboardSyncProps {
  selectedProject: { id: string; title: string; public: boolean } | null;
  githubToken: string;
  tasks: Task[];
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<void>;
  updateSyncTime: () => void;
}

export function useDashboardSync({
  selectedProject,
  githubToken,
  tasks,
  fetchProjectTasks,
  fetchSingleProjectItem,
  updateSyncTime,
}: UseDashboardSyncProps) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);



  const getSyncedTimeText = useCallback((time: number) => {
    if (!time) return '';
    const diff = Date.now() - time;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 5) return t('app.syncedJustNow');
    if (minutes < 60) return t('app.syncedMinutesAgo', { count: minutes });
    if (hours < 24) return t('app.syncedHoursAgo', { count: hours });
    if (days < 30) return t('app.syncedDaysAgo', { count: days });
    if (months < 12) return t('app.syncedMonthsAgo', { count: months });
    return t('app.syncedYearsAgo', { count: years });
  }, [t]);

  // Supabase real-time sync
  useEffect(() => {
    if (!selectedProject?.id || !supabase || !githubToken) return;

    const projectChannelLabel = `project-${selectedProject.id}`;
    const repoNames = Array.from(new Set(tasks.map(t => t.repository).filter(Boolean)));
    const repoChannelLabels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);

    const allChannels = [projectChannelLabel, ...repoChannelLabels];

    const activeChannels = allChannels.map(label => {
      const channel = supabase!.channel(label);
      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProject.id) {
            fetchProjectTasks(selectedProject.id, githubToken);
            updateSyncTime();
          }
        })
        .on('broadcast', { event: 'refresh_task' }, (payload) => {
          const { itemId, contentId } = payload.payload || {};
          console.log(`[DashboardSync] Targeted Refresh RECEIVED on ${label}:`, { itemId, contentId });

          if (githubToken && itemId) {
            fetchSingleProjectItem(itemId, githubToken);
            updateSyncTime();
          } else if (githubToken && contentId) {
            const task = tasks.find(t => t.contentId === contentId);
            if (task && task.itemId) {
              fetchSingleProjectItem(task.itemId, githubToken);
              updateSyncTime();
            } else {
              fetchProjectTasks(selectedProject.id, githubToken);
              updateSyncTime();
            }
          } else {
            fetchProjectTasks(selectedProject.id, githubToken);
            updateSyncTime();
          }
        })
        .subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach(channel => supabase?.removeChannel(channel));
    };
  }, [selectedProject?.id, githubToken, fetchProjectTasks, tasks, fetchSingleProjectItem, updateSyncTime]);

  return {
    getSyncedTimeText,
  };
}
