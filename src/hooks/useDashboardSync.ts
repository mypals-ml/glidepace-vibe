import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Use a ref for tasks and fetch functions to avoid effect re-runs
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const fetchProjectTasksRef = useRef(fetchProjectTasks);
  const fetchSingleItemRef = useRef(fetchSingleProjectItem);
  useEffect(() => { fetchProjectTasksRef.current = fetchProjectTasks; }, [fetchProjectTasks]);
  useEffect(() => { fetchSingleItemRef.current = fetchSingleProjectItem; }, [fetchSingleProjectItem]);

  // Project-level Sync Channel (Stable)
  useEffect(() => {
    if (!selectedProject?.id || !supabase) return;

    const label = `project-${selectedProject.id}`;
    const channel = supabase.channel(label);
    
    console.log(`[DashboardSync] Subscribing to Project Channel: ${label}`);

    channel
      .on('broadcast', { event: 'sync' }, () => {
        console.log(`[DashboardSync] Full Sync Event on ${label}`);
        if (githubToken && selectedProject.id) {
          fetchProjectTasksRef.current(selectedProject.id, githubToken);
        }
      })
      .on('broadcast', { event: 'refresh_task' }, (payload) => {
        const { itemId, contentId } = payload.payload || {};
        console.log(`[DashboardSync] Refresh Task Event on ${label}:`, { itemId, contentId });

        if (githubToken && itemId) {
          fetchSingleItemRef.current(itemId, githubToken);
        } else if (githubToken && contentId) {
          const task = tasksRef.current.find(t => t.contentId === contentId);
          if (task && task.itemId) {
            fetchSingleItemRef.current(task.itemId, githubToken);
          } else {
            fetchProjectTasksRef.current(selectedProject.id, githubToken);
          }
        } else if (githubToken) {
          fetchProjectTasksRef.current(selectedProject.id, githubToken);
        }
      })
      .subscribe((status) => {
        console.log(`[DashboardSync] Project Channel Status (${label}):`, status);
      });

    return () => {
      console.log(`[DashboardSync] Unsubscribing from Project Channel: ${label}`);
      if (supabase) supabase.removeChannel(channel);
    };
  }, [selectedProject?.id, githubToken]);

  // Repo-level Sync Channels (Dynamic based on visible tasks)
  useEffect(() => {
    const s = supabase;
    if (!selectedProject?.id || !s) return;

    const repoNames = Array.from(new Set(tasks.map(t => t.repository).filter(Boolean)));
    const labels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);
    
    if (labels.length === 0) return;

    const activeChannels = labels.map(label => {
      const channel = s.channel(label);
      console.log(`[DashboardSync] Subscribing to Repo Channel: ${label}`);

      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProject.id) {
            fetchProjectTasksRef.current(selectedProject.id, githubToken);
          }
        })
        .on('broadcast', { event: 'refresh_task' }, (payload) => {
          const { itemId, contentId } = payload.payload || {};
          console.log(`[DashboardSync] Refresh Task Event on ${label}:`, { itemId, contentId });
          if (githubToken && itemId) {
            fetchSingleItemRef.current(itemId, githubToken);
          } else if (githubToken && contentId) {
            const task = tasksRef.current.find(t => t.contentId === contentId);
            if (task && task.itemId) {
              fetchSingleItemRef.current(task.itemId, githubToken);
            }
          }
        })
        .subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach(channel => {
        if (supabase) supabase.removeChannel(channel);
      });
    };
  }, [tasks.map(t => t.repository).join(','), selectedProject?.id, githubToken]);

  return {
    lastSyncedTime,
    updateSyncTime,
    getSyncedTimeText,
  };
}
