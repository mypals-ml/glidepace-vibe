import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Task } from '../types';

interface UseDashboardSyncProps {
  githubToken: string;
  selectedProject: { id: string; title: string } | null;
  tasks: Task[];
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<void>;
}

export function useDashboardSync({
  githubToken,
  selectedProject,
  tasks,
  fetchProjectTasks,
  fetchSingleProjectItem,
}: UseDashboardSyncProps) {
  const { t } = useTranslation();

  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => {
    const saved = localStorage.getItem('last_synced_time');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const updateSyncTime = useCallback(() => {
    const now = Date.now();
    setLastSyncedTime(now);
    localStorage.setItem('last_synced_time', now.toString());
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
    if (!selectedProject?.id || !supabase) return;

    const projectChannelLabel = `project-${selectedProject.id}`;
    const repoNames = Array.from(new Set(tasks.map(t => t.repository).filter(Boolean)));
    const repoChannelLabels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);

    const allChannels = [projectChannelLabel, ...repoChannelLabels];

    const activeChannels = allChannels.map(label => {
      const client = supabase;
      if (!client) return null;
      const channel = client.channel(label);
      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProject.id) {
            fetchProjectTasks(selectedProject.id, githubToken);
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
            } else if (selectedProject?.id) {
              fetchProjectTasks(selectedProject.id, githubToken);
            }
          } else if (githubToken && selectedProject?.id) {
            fetchProjectTasks(selectedProject.id, githubToken);
          }
        })
        .subscribe();
      return channel;
    });

    return () => {
      const client = supabase;
      if (client) {
        activeChannels.forEach(channel => {
          if (channel) client.removeChannel(channel);
        });
      }
    };
  }, [selectedProject?.id, githubToken, fetchProjectTasks, tasks, fetchSingleProjectItem]);

  return {
    lastSyncedTime,
    updateSyncTime,
    getSyncedTimeText,
  };
}
