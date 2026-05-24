import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Task } from '../types';

interface UseDashboardSyncProps {
  githubToken: string;
  selectedProject: { id: string; title: string } | null;
  tasks: Task[];
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<void>;
  shouldSkipRecentLocalReorder: (itemId: string | undefined) => boolean;
}

export function useDashboardSync({
  githubToken,
  selectedProject,
  tasks,
  fetchProjectTasks,
  fetchSingleProjectItem,
  shouldSkipRecentLocalReorder,
}: UseDashboardSyncProps) {
  const { t } = useTranslation();
  const selectedProjectId = selectedProject?.id;

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

  const handleReorderSync = useCallback((label: string, payload: unknown) => {
    const data = (payload as { payload?: unknown })?.payload || payload;
    const { itemId } = (data || {}) as { itemId?: string };
    console.log(`[DashboardSync] ↕️ Reorder Event on ${label}:`, { itemId, rawPayload: payload });

    if (!githubToken || !selectedProjectId) return;

    if (shouldSkipRecentLocalReorder(itemId)) {
      console.log(`[DashboardSync] -> Skipping local reorder echo for itemId: ${itemId}`);
      updateSyncTime();
      return;
    }

    fetchProjectTasksRef.current(selectedProjectId, githubToken);
  }, [githubToken, selectedProjectId, shouldSkipRecentLocalReorder, updateSyncTime]);

  // Project-level Sync Channel (Stable)
  useEffect(() => {
    if (!selectedProjectId || !supabase) return;

    const label = `project-${selectedProjectId}`;
    const channel = supabase.channel(label);
    
    console.log(`[DashboardSync] 📡 Subscribing to Project Channel: ${label}`, { 
      projectId: selectedProjectId,
      projectTitle: selectedProject.title 
    });

    channel
      .on('broadcast', { event: 'sync' }, () => {
        console.log(`[DashboardSync] Full Sync Event on ${label}`);
        if (githubToken && selectedProjectId) {
          fetchProjectTasksRef.current(selectedProjectId, githubToken);
        }
      })
      .on('broadcast', { event: 'reorder' }, (payload) => {
        handleReorderSync(label, payload);
      })
      .on('broadcast', { event: 'refresh_task' }, (payload) => {
        const data = payload.payload || payload;
        const { itemId, contentId } = data || {};
        console.log(`[DashboardSync] 🔄 Refresh Task Event on ${label}:`, { itemId, contentId, rawPayload: payload });

        if (githubToken && itemId) {
          console.log(`[DashboardSync] -> Triggering fetchSingleItem for itemId: ${itemId}`);
          fetchSingleItemRef.current(itemId, githubToken);
        } else if (githubToken && contentId) {
          console.log(`[DashboardSync] -> No itemId, searching for contentId: ${contentId}`);
          const task = tasksRef.current.find(t => t.contentId === contentId);
          if (task && task.itemId) {
            console.log(`[DashboardSync] -> Found matching task. itemId: ${task.itemId}`);
            fetchSingleItemRef.current(task.itemId, githubToken);
          } else {
            console.warn(`[DashboardSync] -> No task found with contentId ${contentId}, doing full project refresh.`);
            fetchProjectTasksRef.current(selectedProjectId, githubToken);
          }
        } else if (githubToken) {
          console.warn(`[DashboardSync] -> No itemId or contentId in payload, doing full project refresh.`);
          fetchProjectTasksRef.current(selectedProjectId, githubToken);
        }
      })
      .subscribe((status) => {
        console.log(`[DashboardSync] Project Channel Status (${label}):`, status);
      });

    return () => {
      console.log(`[DashboardSync] Unsubscribing from Project Channel: ${label}`);
      if (supabase) supabase.removeChannel(channel);
    };
  }, [selectedProjectId, selectedProject?.title, githubToken, handleReorderSync]);

  // Repo-level Sync Channels (Dynamic based on visible tasks)
  const repoString = useMemo(() => tasks.map(t => t.repository).join(','), [tasks]);

  useEffect(() => {
    const s = supabase;
    if (!selectedProjectId || !s) return;

    const repoNames = Array.from(new Set(tasksRef.current.map(t => t.repository).filter(Boolean)));
    const labels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);
    
    if (labels.length === 0) return;

    const activeChannels = labels.map(label => {
      const channel = s.channel(label);
      console.log(`[DashboardSync] Subscribing to Repo Channel: ${label}`);

      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProjectId) {
            fetchProjectTasksRef.current(selectedProjectId, githubToken);
          }
        })
        .on('broadcast', { event: 'reorder' }, (payload) => {
          handleReorderSync(label, payload);
        })
        .on('broadcast', { event: 'refresh_task' }, (payload) => {
          const data = payload.payload || payload;
          const { itemId, contentId } = data || {};
          console.log(`[DashboardSync] 🔄 Refresh Task Event on ${label}:`, { itemId, contentId, rawPayload: payload });
          
          if (githubToken && itemId) {
            console.log(`[DashboardSync] -> Triggering fetchSingleItem for itemId: ${itemId}`);
            fetchSingleItemRef.current(itemId, githubToken);
          } else if (githubToken && contentId) {
            console.log(`[DashboardSync] -> No itemId, searching for contentId: ${contentId}`);
            const task = tasksRef.current.find(t => t.contentId === contentId);
            if (task && task.itemId) {
              console.log(`[DashboardSync] -> Found matching task. itemId: ${task.itemId}`);
              fetchSingleItemRef.current(task.itemId, githubToken);
            } else {
              console.warn(`[DashboardSync] -> No task found with contentId ${contentId}, doing full project refresh.`);
              fetchProjectTasksRef.current(selectedProjectId, githubToken);
            }
          } else if (githubToken) {
            console.warn(`[DashboardSync] -> No itemId or contentId in payload, doing full project refresh.`);
            fetchProjectTasksRef.current(selectedProjectId, githubToken);
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
  }, [repoString, selectedProjectId, githubToken, handleReorderSync]);

  // Owner-level Fallback Channel (For when project/repo IDs mismatch)
  useEffect(() => {
    const s = supabase;
    if (!selectedProjectId || !s) return;

    // We can't easily get the owner from tasksRef, so we try to infer it or just skip if not possible.
    // For now, let's use the repo owner of the first task as a hint.
    const firstTask = tasksRef.current.find(t => t.repository);
    const owner = firstTask?.repository?.split('/')[0];
    
    if (!owner) return;

    const label = `owner-${owner}`;
    const channel = s.channel(label);
    console.log(`[DashboardSync] 🛡️ Subscribing to Owner Fallback Channel: ${label}`);

    channel
      .on('broadcast', { event: 'sync' }, () => {
        console.log(`[DashboardSync] 🛡️ Fallback Sync Event on ${label}`);
        fetchProjectTasksRef.current(selectedProjectId, githubToken);
      })
      .on('broadcast', { event: 'reorder' }, (payload) => {
        const data = (payload.payload || payload) as { projectId?: string };
        if (data.projectId && data.projectId !== selectedProjectId) return;
        handleReorderSync(label, payload);
      })
      .on('broadcast', { event: 'refresh_task' }, (payload) => {
        const data = payload.payload || payload;
        const { itemId, contentId, projectId } = data || {};
        
        // If the payload contains a projectId that doesn't match ours, ignore it
        if (projectId && projectId !== selectedProjectId) return;

        console.log(`[DashboardSync] 🛡️ Fallback Refresh Event on ${label}:`, { itemId, contentId });
        
        if (githubToken && itemId) {
          fetchSingleItemRef.current(itemId, githubToken);
        } else if (githubToken && contentId) {
          const task = tasksRef.current.find(t => t.contentId === contentId);
          if (task && task.itemId) {
            fetchSingleItemRef.current(task.itemId, githubToken);
          } else {
            fetchProjectTasksRef.current(selectedProjectId, githubToken);
          }
        }
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [repoString, selectedProjectId, githubToken, handleReorderSync]);

  return {
    lastSyncedTime,
    updateSyncTime,
    getSyncedTimeText,
  };
}
