import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, updateProjectV2ItemField, isGitHubRateLimitError } from '../../lib/githubService';
import { mapProjectItemToTask } from '../../lib/githubTaskMapper';
import { registerStatuses } from '../../utils/statusColors';
import { reconcileProjectSnapshot, reconcileSingleTask } from '../../lib/taskReconciliation';
import { logDashboardEvent } from '../../lib/dashboardDebugLog';
import { GET_SINGLE_ITEM_QUERY, GET_PROJECT_TASKS_QUERY } from '../../lib/githubQueries';
import { getProjectFixedStartDateMode, persistDependencyFieldCorrections } from './taskFieldHelpers';
import type { Task, GitHubProjectItem, GitHubProjectV2Field } from '../../types';
import type { DashboardTasksCore, FetchProjectTasksOptions, MutableRef } from './types';

const TASK_SNAPSHOT_CACHE_VERSION = 1;

interface CachedTaskSnapshot {
  version: typeof TASK_SNAPSHOT_CACHE_VERSION;
  projectId: string;
  projectAccountId: string;
  savedAt: number;
  tasks: Task[];
  projectFields: GitHubProjectV2Field[];
  statusOptions: Array<{ name: string; color?: string }>;
}

interface UseTaskFetchProps {
  core: DashboardTasksCore;
  projectAccountId: string;
  captureViewportAnchorRef: MutableRef<(() => void) | undefined>;
}

function getTaskSnapshotCacheKey(projectAccountId: string, projectId: string): string {
  return `dashboard_task_snapshot_v${TASK_SNAPSHOT_CACHE_VERSION}:${projectAccountId || 'unknown'}:${projectId}`;
}

function readCachedTaskSnapshot(projectAccountId: string, projectId: string): CachedTaskSnapshot | null {
  try {
    const raw = localStorage.getItem(getTaskSnapshotCacheKey(projectAccountId, projectId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedTaskSnapshot>;
    if (
      parsed.version !== TASK_SNAPSHOT_CACHE_VERSION ||
      parsed.projectId !== projectId ||
      parsed.projectAccountId !== projectAccountId ||
      !Array.isArray(parsed.tasks)
    ) {
      return null;
    }

    return {
      version: TASK_SNAPSHOT_CACHE_VERSION,
      projectId,
      projectAccountId,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      tasks: parsed.tasks,
      projectFields: Array.isArray(parsed.projectFields) ? parsed.projectFields : [],
      statusOptions: Array.isArray(parsed.statusOptions) ? parsed.statusOptions : [],
    };
  } catch (error) {
    console.warn('[DashboardTasks] Failed to read cached task snapshot:', error);
    return null;
  }
}

function writeCachedTaskSnapshot(snapshot: CachedTaskSnapshot): void {
  try {
    localStorage.setItem(
      getTaskSnapshotCacheKey(snapshot.projectAccountId, snapshot.projectId),
      JSON.stringify(snapshot),
    );
  } catch (error) {
    console.warn('[DashboardTasks] Failed to cache task snapshot:', error);
  }
}

function isRateLimitMessage(message: string): boolean {
  return /rate limit|rate-limit|api rate limit/i.test(message);
}

/**
 * Project/item fetching: full project snapshots (with fields pagination) and
 * single-item refreshes, both reconciled against the synchronously-tracked
 * task list.
 */
export function useTaskFetch({ core, projectAccountId, captureViewportAnchorRef }: UseTaskFetchProps) {
  const { t } = useTranslation();
  const { selectedProject, dateSettingsRef, tasksRef, setTasks, updateSyncTime, showToast } = core;

  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
  const [projectFields, setProjectFields] = useState<GitHubProjectV2Field[]>([]);
  const [fieldsProgress, setFieldsProgress] = useState<{ current: number; total: number; isFetching: boolean }>({ current: 0, total: 0, isFetching: false });
  const [apiError, setApiError] = useState<string | null>(null);
  const lastLoadedProjectIdRef = useRef<string | null>(null);

  const applyCachedTaskSnapshot = useCallback((snapshot: CachedTaskSnapshot) => {
    setApiError(null);
    setProjectFields(snapshot.projectFields);

    if (snapshot.statusOptions.length > 0) {
      registerStatuses(snapshot.statusOptions);
      setProjectStatusOptions(snapshot.statusOptions.map(option => option.name));
    } else {
      setProjectStatusOptions([]);
    }

    setTasks(snapshot.tasks);
    lastLoadedProjectIdRef.current = snapshot.projectId;
  }, [setTasks]);

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string): Promise<Task | null> => {
    console.log(`[DashboardTasks] 📡 Fetching single item: ${itemId}`);
    try {
      const json = await fetchGitHubGraphQL(GET_SINGLE_ITEM_QUERY, { itemId }, token, {
        operationType: 'query',
        dedupeKey: `singleItem:${itemId}`,
      });
      console.log(`[DashboardTasks] 📥 GraphQL Response for ${itemId}:`, json);
      const itemData = json.data?.node as GitHubProjectItem;

      if (itemData) {
        const updatedTask = mapProjectItemToTask(itemData, dateSettingsRef.current);
        console.log(`[DashboardTasks] ✅ Mapped Task for ${itemId}:`, {
          title: updatedTask.title,
          status: updatedTask.status,
          isDraft: updatedTask.isDraft,
          contentId: updatedTask.contentId
        });

        // Reconcile against the synchronously-tracked tasksRef and apply in
        // the same tick. setTasks (array form) updates tasksRef synchronously,
        // so no competing update can interleave between read and apply.
        // Unchanged tasks keep their object references, so memoized rows skip
        // rerendering.
        const reconciliation = reconcileSingleTask(tasksRef.current, updatedTask, {
          fixedStartDateMode: getProjectFixedStartDateMode(dateSettingsRef.current),
          insertMissing: true,
        });
        if (reconciliation.tasks !== tasksRef.current) {
          setTasks(reconciliation.tasks);
        }

        if (selectedProject?.id) {
          await persistDependencyFieldCorrections(reconciliation.corrections, reconciliation.tasks, selectedProject.id, token, dateSettingsRef.current);
        }
        updateSyncTime();

        // Auto-sync missing values for Done tasks
        if (updatedTask.progress === 100 && updatedTask.itemId && selectedProject?.id) {
          const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
            if (fieldId) await updateProjectV2ItemField(selectedProject.id, updatedTask.itemId!, fieldId, value, token);
          };
          if (updatedTask.estimate === undefined && updatedTask.tempEstimate !== undefined) {
            updateField(dateSettingsRef.current.estimateFieldId || updatedTask.projectFieldIds?.estimate, { number: updatedTask.tempEstimate });
          }
        }
        return updatedTask;
      } else {
        console.warn(`[DashboardTasks] ⚠️ No item data returned for ${itemId}`);
      }
    } catch (e) {
      console.error('Failed to fetch single project item:', e);
    }
    return null;
  }, [updateSyncTime, selectedProject?.id, setTasks, dateSettingsRef, tasksRef]);

  const fetchProjectTasks = useCallback(async (projectId: string, token: string, options?: FetchProjectTasksOptions) => {
    // Background mode only makes sense when there is usable data to keep on
    // screen; without existing tasks it degrades to the initial loading UI.
    const isBackground = options?.mode === 'background' && tasksRef.current.length > 0;
    if (!isBackground) {
      setIsLoadingTasks(true);
    }
    setIsRefreshingTasks(true);
    setFieldsProgress({ current: 0, total: 0, isFetching: true });
    logDashboardEvent('[DashboardTasks] Refresh started', {
      refreshKind: 'full_project',
      mode: isBackground ? 'background' : 'initial',
      reason: options?.reason || 'initial_load',
      projectId,
      projectAccountId,
    });
    try {
      let hasNextFields = true;
      let hasNextItems = true;
      let fieldsCursor: string | undefined = undefined;
      let itemsCursor: string | undefined = undefined;

      const allItems: GitHubProjectItem[] = [];
      const allFields: GitHubProjectV2Field[] = [];

      while (hasNextFields || hasNextItems) {
        const variables: Record<string, string | number | boolean | undefined> = { projectId };
        if (hasNextFields && fieldsCursor) variables.fieldsCursor = fieldsCursor;
        if (hasNextItems && itemsCursor) variables.itemsCursor = itemsCursor;
        // Once a connection is fully paged, skip re-requesting it on subsequent
        // iterations instead of fetching a completed connection again.
        variables.skipFields = !hasNextFields;
        variables.skipItems = !hasNextItems;

        const json = await fetchGitHubGraphQL(GET_PROJECT_TASKS_QUERY, variables, token, {
          operationType: 'query',
          priority: isBackground ? 'background' : 'foreground',
        });

        const projectNode = json.data?.node as {
          fields?: {
            totalCount: number,
            nodes: GitHubProjectV2Field[],
            pageInfo: { hasNextPage: boolean, endCursor: string }
          },
          items?: {
            nodes: GitHubProjectItem[],
            pageInfo: { hasNextPage: boolean, endCursor: string }
          }
        };

        if (json.errors) {
          console.warn('GraphQL Errors (possibly non-fatal) fetching items:', JSON.stringify(json.errors, null, 2));
          if (!projectNode) {
            console.error('Fatal GraphQL Error: No project node returned.');
            const errorMessage = json.errors.map((e: { message: string }) => e.message).join(', ');
            const rateLimitedGraphQLError = isRateLimitMessage(errorMessage);
            if (isBackground) {
              // Never blank a usable task list because a background refresh
              // failed; keep stale data and surface the failure non-modally.
              logDashboardEvent('[DashboardTasks] Background refresh failed', {
                refreshKind: 'full_project',
                projectId,
                reason: options?.reason,
                error: errorMessage,
              }, 'warn');
              showToast(
                rateLimitedGraphQLError
                  ? t('dashboard.rateLimitShowingStale', 'GitHub rate limit reached. Showing the last known state.')
                  : t('dashboard.backgroundRefreshFailed', 'Failed to refresh tasks from GitHub. Showing the last known state.'),
                'error',
              );
            } else {
              const cachedSnapshot = readCachedTaskSnapshot(projectAccountId, projectId);
              if (rateLimitedGraphQLError && cachedSnapshot) {
                applyCachedTaskSnapshot(cachedSnapshot);
                showToast(t('dashboard.rateLimitShowingStale', 'GitHub rate limit reached. Showing the last known state.'), 'error');
              } else {
                setApiError(errorMessage);
                setTasks([]);
              }
            }
            return;
          }
        }

        if (hasNextFields) {
          const fieldsConn = projectNode?.fields;
          if (fieldsConn) {
            const newFields = fieldsConn.nodes || [];
            allFields.push(...newFields);

            setFieldsProgress(prev => ({
              ...prev,
              total: fieldsConn.totalCount || prev.total,
              current: allFields.length
            }));

            hasNextFields = fieldsConn.pageInfo?.hasNextPage || false;
            fieldsCursor = fieldsConn.pageInfo?.endCursor;
          } else {
            hasNextFields = false;
          }
        }

        if (hasNextItems) {
          const itemsConn = projectNode?.items;
          if (itemsConn) {
            allItems.push(...(itemsConn.nodes || []));
            hasNextItems = itemsConn.pageInfo?.hasNextPage || false;
            itemsCursor = itemsConn.pageInfo?.endCursor;
          } else {
            hasNextItems = false;
          }
        }
      }

      setApiError(null);

      // Reconcile the authoritative GitHub snapshot against the
      // synchronously-tracked tasksRef and apply in the same tick (no awaits
      // between read and setTasks, so no competing update can interleave).
      // Unchanged tasks keep their object references for memoized rows.
      const previousTasks = tasksRef.current;
      const mappedFetchedTasks: Task[] = allItems.map(item => mapProjectItemToTask(item, dateSettingsRef.current));
      const reconciliation = reconcileProjectSnapshot(previousTasks, mappedFetchedTasks, {
        fixedStartDateMode: getProjectFixedStartDateMode(dateSettingsRef.current),
      });

      if (reconciliation.tasks !== previousTasks) {
        // Capture the viewport anchor at apply time (not fetch start): the
        // user may have kept scrolling while the request was in flight.
        if (isBackground && options?.preserveViewport) {
          captureViewportAnchorRef.current?.();
        }
        setTasks(reconciliation.tasks);
      }

      logDashboardEvent('[DashboardTasks] Refresh completed', {
        refreshKind: 'full_project',
        mode: isBackground ? 'background' : 'initial',
        projectId,
        refreshedItemCount: reconciliation.tasks.length,
        refreshedFieldCount: allFields.length,
        addedTaskIds: reconciliation.addedTaskIds,
        removedTaskIds: reconciliation.removedTaskIds,
        updatedTaskCount: reconciliation.updatedTaskIds.length,
        movedTaskCount: reconciliation.movedTaskIds.length,
      });

      const statusField = allFields.find((f: GitHubProjectV2Field) => f.name?.toLowerCase() === 'status');
      const statusOptions = (statusField?.options || []) as Array<{ name: string, color?: string }>;

      if (statusOptions.length > 0) {
        registerStatuses(statusOptions);
        setProjectStatusOptions(statusOptions.map(o => o.name));
      } else {
        setProjectStatusOptions([]);
      }

      setProjectFields(allFields);
      writeCachedTaskSnapshot({
        version: TASK_SNAPSHOT_CACHE_VERSION,
        projectId,
        projectAccountId,
        savedAt: Date.now(),
        tasks: reconciliation.tasks,
        projectFields: allFields,
        statusOptions,
      });
      lastLoadedProjectIdRef.current = projectId;
      if (selectedProject?.id) {
        await persistDependencyFieldCorrections(reconciliation.corrections, reconciliation.tasks, selectedProject.id, token, dateSettingsRef.current);
      }
      updateSyncTime();

      // Auto-sync missing values for Done tasks
      reconciliation.tasks.forEach(task => {
        if (task.progress === 100 && task.itemId && selectedProject?.id) {
          const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
            if (fieldId) await updateProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, value, token);
          };
          if (task.estimate === undefined && task.tempEstimate !== undefined) {
            updateField(dateSettingsRef.current.estimateFieldId || task.projectFieldIds?.estimate, { number: task.tempEstimate });
          }
        }
      });
    } catch (err) {
      const error = err as Error;
      const rateLimited = isGitHubRateLimitError(err);
      console.error('Failed to fetch project tasks:', error);
      if (isBackground) {
        logDashboardEvent('[DashboardTasks] Background refresh failed', {
          refreshKind: 'full_project',
          projectId,
          reason: options?.reason,
          error: error.message,
          rateLimited,
        }, 'warn');
        // Rate-limit failures keep the existing tasks on screen and show a
        // distinct, calmer message; ordinary failures use the generic toast.
        showToast(
          rateLimited
            ? t('dashboard.rateLimitShowingStale', 'GitHub rate limit reached. Showing the last known state.')
            : t('dashboard.backgroundRefreshFailed', 'Failed to refresh tasks from GitHub. Showing the last known state.'),
          'error'
        );
      } else if (rateLimited) {
        const staleMessage = t('dashboard.rateLimitShowingStale', 'GitHub rate limit reached. Showing the last known state.');
        const cachedSnapshot = readCachedTaskSnapshot(projectAccountId, projectId);
        const hasCurrentProjectTasks = lastLoadedProjectIdRef.current === projectId && tasksRef.current.length > 0;

        showToast(staleMessage, 'error');
        if (cachedSnapshot) {
          applyCachedTaskSnapshot(cachedSnapshot);
          logDashboardEvent('[DashboardTasks] Foreground refresh used cached snapshot after rate limit', {
            refreshKind: 'full_project',
            projectId,
            projectAccountId,
            cachedTaskCount: cachedSnapshot.tasks.length,
            cachedAt: cachedSnapshot.savedAt,
          }, 'warn');
        } else if (hasCurrentProjectTasks) {
          setApiError(null);
        } else {
          setApiError(staleMessage);
        }
      } else {
        setApiError(error.message || t('dashboard.unknownError'));
      }
    } finally {
      if (!isBackground) {
        setIsLoadingTasks(false);
      }
      setIsRefreshingTasks(false);
      setFieldsProgress(prev => ({ ...prev, isFetching: false }));
    }
  }, [updateSyncTime, t, projectAccountId, selectedProject?.id, setTasks, showToast, tasksRef, dateSettingsRef, captureViewportAnchorRef, applyCachedTaskSnapshot]);

  return {
    isLoadingTasks,
    setIsLoadingTasks,
    isRefreshingTasks,
    projectStatusOptions,
    setProjectStatusOptions,
    projectFields,
    fieldsProgress,
    apiError,
    fetchSingleProjectItem,
    fetchProjectTasks,
  };
}
