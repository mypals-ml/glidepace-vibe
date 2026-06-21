import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Task } from '../types';
import { getReorderRefreshDecision } from '../lib/reorderSyncUtils';
import {
  createSyncEventDeduper,
  getSyncEventFingerprint,
  isEventForSelectedProject,
  normalizeGithubSyncPayload,
} from '../lib/githubSyncEvents';
import type { GithubSyncBroadcastEvent } from '../lib/githubSyncEvents';
import type { FetchProjectTasksOptions } from './useDashboardTasks';
import { logDashboardEvent } from '../lib/dashboardDebugLog';

interface UseDashboardSyncProps {
  githubToken: string;
  selectedProject: { id: string; title: string } | null;
  tasks: Task[];
  fetchProjectTasks: (projectId: string, token: string, options?: FetchProjectTasksOptions) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<Task | null>;
  refreshForecastAssumptionsFromGitHub?: () => Promise<void>;
  shouldSkipRecentLocalReorder: (itemId: string | undefined) => boolean;
  shouldSkipRecentLocalReorderSync: () => boolean;
}

interface FullRefreshState {
  projectId: string | null;
  inFlight: boolean;
  queued: boolean;
}

export function useDashboardSync({
  githubToken,
  selectedProject,
  tasks,
  fetchProjectTasks,
  fetchSingleProjectItem,
  refreshForecastAssumptionsFromGitHub,
  shouldSkipRecentLocalReorder,
  shouldSkipRecentLocalReorderSync,
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
  const refreshForecastAssumptionsRef = useRef(refreshForecastAssumptionsFromGitHub);
  useEffect(() => { fetchProjectTasksRef.current = fetchProjectTasks; }, [fetchProjectTasks]);
  useEffect(() => { fetchSingleItemRef.current = fetchSingleProjectItem; }, [fetchSingleProjectItem]);
  useEffect(() => {
    refreshForecastAssumptionsRef.current = refreshForecastAssumptionsFromGitHub;
  }, [refreshForecastAssumptionsFromGitHub]);

  // The same webhook delivery can arrive through the project, repo, AND
  // owner channels. Fingerprint dedupe collapses those duplicates.
  const dedupeRef = useRef(createSyncEventDeduper());
  // Guards against concurrent single-item fetches for the same item.
  const inFlightSingleItemIdsRef = useRef(new Set<string>());
  // Coalesces full refreshes: while one is in flight, further requests fold
  // into a single trailing refresh instead of stacking network calls.
  const fullRefreshStateRef = useRef<FullRefreshState>({ projectId: null, inFlight: false, queued: false });

  const runBackgroundFullRefresh = useCallback(async (reason: NonNullable<FetchProjectTasksOptions['reason']>) => {
    if (!githubToken || !selectedProjectId) return;

    const state = fullRefreshStateRef.current;
    if (state.projectId !== selectedProjectId) {
      state.projectId = selectedProjectId;
      state.inFlight = false;
      state.queued = false;
    }

    if (state.inFlight) {
      state.queued = true;
      logDashboardEvent('[DashboardSync] Refresh coalesced', {
        refreshKind: 'background_full_project',
        projectId: selectedProjectId,
        reason,
      });
      return;
    }

    state.inFlight = true;
    try {
      do {
        state.queued = false;
        await fetchProjectTasksRef.current(selectedProjectId, githubToken, {
          mode: 'background',
          reason,
          preserveViewport: true,
        });
      } while (state.queued);

      try {
        await refreshForecastAssumptionsRef.current?.();
      } catch (error) {
        console.error('[DashboardSync] Forecast assumptions refresh failed:', error);
      }
    } finally {
      state.inFlight = false;
    }
  }, [githubToken, selectedProjectId]);

  const handleSingleTaskEvent = useCallback((itemId: string | undefined, contentId: string | undefined, channelLabel: string) => {
    if (!githubToken || !selectedProjectId) return;

    let resolvedItemId = itemId;
    if (!resolvedItemId && contentId) {
      // Confirm-only membership test: finding the contentId proves the issue
      // is ours and resolves the project item id in one step.
      resolvedItemId = tasksRef.current.find(task => task.contentId === contentId)?.itemId;
      if (!resolvedItemId) {
        console.warn(`[DashboardSync] No task found with contentId ${contentId} on ${channelLabel}, doing background full refresh.`);
        void runBackgroundFullRefresh('fallback');
        return;
      }
    }

    if (!resolvedItemId) {
      console.warn(`[DashboardSync] No itemId or contentId in payload on ${channelLabel}, doing background full refresh.`);
      void runBackgroundFullRefresh('fallback');
      return;
    }

    const isKnownItem = tasksRef.current.some(task => task.itemId === resolvedItemId);
    if (!isKnownItem) {
      // A new item's position is unknown locally; only a full snapshot
      // carries GitHub's ordering.
      console.log(`[DashboardSync] Unknown itemId ${resolvedItemId}, doing background full refresh to pick up ordering.`);
      void runBackgroundFullRefresh('fallback');
      return;
    }

    if (inFlightSingleItemIdsRef.current.has(resolvedItemId)) {
      logDashboardEvent('[DashboardSync] Single item fetch already in flight', {
        itemId: resolvedItemId,
        channel: channelLabel,
      });
      return;
    }

    inFlightSingleItemIdsRef.current.add(resolvedItemId);
    const itemIdToFetch = resolvedItemId;
    void (async () => {
      try {
        const fetched = await fetchSingleItemRef.current(itemIdToFetch, githubToken);
        if (fetched === null) {
          // Null for a known item usually means it was archived or deleted;
          // a background snapshot removes it without blanking the UI.
          await runBackgroundFullRefresh('fallback');
        }
      } finally {
        inFlightSingleItemIdsRef.current.delete(itemIdToFetch);
      }
    })();
  }, [githubToken, selectedProjectId, runBackgroundFullRefresh]);

  // One shared handler for project, repo, and owner channels.
  const handleSyncEvent = useCallback((broadcastEvent: GithubSyncBroadcastEvent, rawPayload: unknown, channelLabel: string) => {
    if (!githubToken || !selectedProjectId) return;

    const event = normalizeGithubSyncPayload(broadcastEvent, rawPayload, channelLabel);
    console.log(`[DashboardSync] 📥 ${event.kind} event on ${channelLabel}:`, {
      itemId: event.itemId,
      contentId: event.contentId,
      action: event.action,
      deliveryId: event.deliveryId,
    });

    // A present-but-different projectId proves the event is for another
    // project; a missing projectId can only be "possibly ours".
    if (!isEventForSelectedProject(event, selectedProjectId)) {
      return;
    }

    const fingerprint = getSyncEventFingerprint(event);
    if (!dedupeRef.current.shouldProcess(fingerprint)) {
      logDashboardEvent('[DashboardSync] Duplicate event suppressed', {
        fingerprint,
        kind: event.kind,
        channel: channelLabel,
      });
      return;
    }

    if (event.kind === 'reorder') {
      const refreshDecision = getReorderRefreshDecision(
        event.itemId,
        tasksRef.current.length,
        shouldSkipRecentLocalReorder
      );

      if (refreshDecision.refreshKind === 'local_reorder_echo') {
        logDashboardEvent('[DashboardSync] Refresh skipped', {
          refreshKind: refreshDecision.refreshKind,
          itemId: event.itemId,
          projectId: selectedProjectId,
          refreshedItemCount: refreshDecision.refreshedItemCount,
        });
        updateSyncTime();
        return;
      }

      logDashboardEvent('[DashboardSync] Refresh requested', {
        refreshKind: 'external_reorder_full_project',
        itemId: event.itemId,
        projectId: selectedProjectId,
        expectedRefreshedItemCount: refreshDecision.refreshedItemCount,
      });
      void runBackgroundFullRefresh('external_reorder');
      return;
    }

    if (event.kind === 'full_project') {
      if (shouldSkipRecentLocalReorderSync()) {
        logDashboardEvent('[DashboardSync] Refresh skipped', {
          refreshKind: 'local_reorder_sync_echo',
          projectId: selectedProjectId,
          channel: channelLabel,
          refreshedItemCount: 0,
        });
        updateSyncTime();
        return;
      }

      void runBackgroundFullRefresh('webhook_sync');
      return;
    }

    handleSingleTaskEvent(event.itemId, event.contentId, channelLabel);
  }, [githubToken, selectedProjectId, shouldSkipRecentLocalReorder, shouldSkipRecentLocalReorderSync, updateSyncTime, runBackgroundFullRefresh, handleSingleTaskEvent]);

  const subscribeChannelToSyncEvents = useCallback((channel: RealtimeChannel, label: string) => {
    return channel
      .on('broadcast', { event: 'sync' }, (payload: unknown) => {
        handleSyncEvent('sync', payload, label);
      })
      .on('broadcast', { event: 'reorder' }, (payload: unknown) => {
        handleSyncEvent('reorder', payload, label);
      })
      .on('broadcast', { event: 'refresh_task' }, (payload: unknown) => {
        handleSyncEvent('refresh_task', payload, label);
      });
  }, [handleSyncEvent]);

  // Project-level Sync Channel (Stable)
  useEffect(() => {
    if (!selectedProjectId || !supabase) return;

    const label = `project-${selectedProjectId}`;
    const channel = supabase.channel(label);

    console.log(`[DashboardSync] 📡 Subscribing to Project Channel: ${label}`, {
      projectId: selectedProjectId,
      projectTitle: selectedProject.title
    });

    subscribeChannelToSyncEvents(channel, label).subscribe((status) => {
      console.log(`[DashboardSync] Project Channel Status (${label}):`, status);
    });

    return () => {
      console.log(`[DashboardSync] Unsubscribing from Project Channel: ${label}`);
      if (supabase) supabase.removeChannel(channel);
    };
  }, [selectedProjectId, selectedProject?.title, subscribeChannelToSyncEvents]);

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
      subscribeChannelToSyncEvents(channel, label).subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach(channel => {
        if (supabase) supabase.removeChannel(channel);
      });
    };
  }, [repoString, selectedProjectId, subscribeChannelToSyncEvents]);

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

    subscribeChannelToSyncEvents(channel, label).subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [repoString, selectedProjectId, subscribeChannelToSyncEvents]);

  return {
    lastSyncedTime,
    updateSyncTime,
    getSyncedTimeText,
  };
}
