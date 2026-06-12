import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, getRepositoryId, createGitHubIssue, addProjectV2Item, addProjectV2DraftIssue, updateProjectV2ItemField, clearProjectV2ItemField, updateProjectV2ItemPosition } from '../lib/githubService';
import { mapProjectItemToTask, mapGitHubCommentToTaskComment } from '../lib/githubTaskMapper';
import { formatToGitHubDate, calculateTargetDate } from '../lib/dateUtils';
import { registerStatuses } from '../utils/statusColors';
import { autoCorrectDependencyFields, cascadeTaskDates, getFixedStartDateUpdateCandidates, recalculateFloatingSuccessorDates, shouldAskToUpdateFixedSuccessorStartDate, withUpdatedPredecessorIds } from '../lib/taskDependencyUtils';
import { getAfterIdForAppend, getAfterIdForInsertPosition, getTaskOrderId, moveTaskAfter, moveTaskBlockAfter, upsertTaskAfter, type DashboardFieldValueChange } from '../lib/taskOrderUtils';
import { applyFieldGroupPaths, buildGroupBlocksFromOrderedTasks, renameGroupBlock as renameGroupBlockInTasks, serializeGroupPath, ungroupGroupBlock as ungroupGroupBlockInTasks, isTaskGroupBlock, moveTasksToGroupPath } from '../lib/taskGroupUtils';
import type { DependencyFieldCorrection } from '../lib/taskDependencyUtils';
import { reconcileProjectSnapshot, reconcileSingleTask } from '../lib/taskReconciliation';
import { logDashboardEvent } from '../lib/dashboardDebugLog';
import { 
  GET_SINGLE_ITEM_QUERY, 
  GET_PROJECT_TASKS_QUERY, 
  SEARCH_ASSIGNABLE_USERS_QUERY, 
  SEARCH_ORG_MEMBERS_QUERY, 
  SEARCH_GLOBAL_USERS_QUERY,
  ADD_ASSIGNEES_MUTATION,
  REMOVE_ASSIGNEES_MUTATION,
  UPDATE_ISSUE_TITLE_MUTATION,
  UPDATE_ISSUE_BODY_MUTATION,
  UPDATE_DRAFT_TITLE_MUTATION,
  UPDATE_DRAFT_BODY_MUTATION,
  UPDATE_DRAFT_ASSIGNEES_MUTATION,
  UPDATE_ISSUE_COMMENT_MUTATION,
  DELETE_ISSUE_COMMENT_MUTATION,
  ADD_ISSUE_COMMENT_MUTATION,
  DELETE_PROJECT_ITEM_MUTATION,
  DELETE_ISSUE_MUTATION,
  GET_ISSUE_COMMENTS_QUERY
} from '../lib/githubQueries';
import type { Task, TaskComment, TaskStatus, User, GithubAccount, ProjectOwnerInfo, GitHubProjectItem, GitHubProjectV2Field, GitHubAssignee, ProjectDateSettings, AutoUpdateStartDateMode, FixedSuccessorStartDateMode, TaskInsertPosition, GroupPath } from '../types';

export interface FetchProjectTasksOptions {
  /**
   * 'initial' shows the loading UI and replaces everything (project open or
   * project switch). 'background' keeps the current task list and Gantt
   * visible while fetching; it never blanks the UI, even on failure.
   */
  mode?: 'initial' | 'background';
  reason?: 'initial_load' | 'manual_sync' | 'webhook_sync' | 'external_reorder' | 'fallback';
  /** Capture and restore the viewport anchor around applying the snapshot. */
  preserveViewport?: boolean;
}

interface UseDashboardTasksProps {
  githubToken: string;
  selectedProject: { id: string; title: string; public: boolean; accountId?: string } | null;
  projectsData: ProjectOwnerInfo[];
  projectAccountId: string;
  githubAccounts: GithubAccount[];
  updateSyncTime: () => void;
  setIsCreateMode: (val: boolean) => void;
  dateSettings: ProjectDateSettings;
  requestStartDateDecision: (tasks: Task[]) => Promise<'auto' | 'locked' | 'ask'>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  markRecentLocalReorder: (itemIds: string[]) => void;
  /** Registered by the layout; queues a viewport anchor for the next render. */
  captureViewportAnchor?: () => void;
}

function uniqueTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter(task => {
    const id = task.itemId || task.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getProjectFixedStartDateMode(dateSettings: ProjectDateSettings): FixedSuccessorStartDateMode {
  return dateSettings.fixedSuccessorStartDateMode || 'ask';
}

function preserveUniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function getExistingPredecessorIds(tasks: Task[], successorTask: Task): string[] {
  if (successorTask.predecessorIds && successorTask.predecessorIds.length > 0) {
    return successorTask.predecessorIds;
  }

  const successorTaskId = successorTask.itemId || successorTask.id;
  return tasks
    .filter(task => (task.successorIds || []).includes(successorTaskId))
    .map(task => task.itemId || task.id);
}

function getProjectFieldUpdateValue(field: GitHubProjectV2Field | undefined, value: string): unknown {
  const optionId = field?.options?.find(option => option.name === value)?.id;
  return optionId ? { singleSelectOptionId: optionId } : { text: value };
}

function applyTaskFieldValueChanges(task: Task, fieldValueChanges: DashboardFieldValueChange[]): Task {
  if (fieldValueChanges.length === 0) return task;

  const nextProjectFieldValues = { ...(task.projectFieldValues || {}) };
  let nextTask = task;

  for (const change of fieldValueChanges) {
    nextProjectFieldValues[change.fieldId] = change.value;

    if (task.projectFieldIds?.status === change.fieldId) {
      const progress = /^(done|closed|completed|merged)$/i.test(change.value)
        ? 100
        : /^(todo|backlog|open|not started)$/i.test(change.value)
          ? 0
          : 50;
      nextTask = {
        ...nextTask,
        status: change.value,
        progress,
      };
    }
  }

  return {
    ...nextTask,
    projectFieldValues: nextProjectFieldValues,
  };
}

async function persistDependencyFieldCorrections(
  corrections: DependencyFieldCorrection[],
  tasks: Task[],
  selectedProjectId: string,
  githubToken: string,
  dateSettings: ProjectDateSettings
) {
  for (const correction of corrections) {
    const task = tasks.find(t => (t.itemId || t.id) === correction.taskId);
    if (!task?.itemId) continue;

    const fieldId = correction.field === 'successor'
      ? (dateSettings.successorFieldId || task.projectFieldIds?.successor)
      : (dateSettings.predecessorFieldId || task.projectFieldIds?.predecessor);
    if (!fieldId) continue;

    await updateProjectV2ItemField(
      selectedProjectId,
      task.itemId,
      fieldId,
      { text: correction.ids.join(',') },
      githubToken
    );
  }
}

export function useDashboardTasks({
  githubToken,
  selectedProject,
  projectsData,
  projectAccountId,
  githubAccounts,
  updateSyncTime,
  setIsCreateMode,
  dateSettings,
  requestStartDateDecision,
  showToast,
  markRecentLocalReorder,
  captureViewportAnchor,
}: UseDashboardTasksProps) {
  const { t } = useTranslation();

  const [tasks, setTasksState] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const setTasks = useCallback((newTasksOrUpdater: Task[] | ((prev: Task[]) => Task[])) => {
    if (Array.isArray(newTasksOrUpdater)) {
      tasksRef.current = newTasksOrUpdater;
    }
    setTasksState(prev => {
      const next = typeof newTasksOrUpdater === 'function' ? newTasksOrUpdater(prev) : newTasksOrUpdater;
      tasksRef.current = next;
      return next;
    });
  }, []);

  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [isFetchingComments, setIsFetchingComments] = useState<Record<string, boolean>>({});
  const ongoingCommentFetchesRef = useRef<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
  const [projectFields, setProjectFields] = useState<GitHubProjectV2Field[]>([]);
  const [fieldsProgress, setFieldsProgress] = useState<{ current: number; total: number; isFetching: boolean }>({ current: 0, total: 0, isFetching: false });
  const [apiError, setApiError] = useState<string | null>(null);
  const [collapsedGroupBlockIds, setCollapsedGroupBlockIds] = useState<string[]>([]);
  const [selectedGroupFieldIds, setSelectedGroupFieldIds] = useState<string[]>([]);
  
  const dateSettingsRef = useRef(dateSettings);
  useEffect(() => {
    dateSettingsRef.current = dateSettings;
  }, [dateSettings]);

  const captureViewportAnchorRef = useRef(captureViewportAnchor);
  useEffect(() => {
    captureViewportAnchorRef.current = captureViewportAnchor;
  }, [captureViewportAnchor]);

  const availableUsers = useMemo<User[]>(() => {
    const userMap = new Map<string, User>();
    (tasks || []).forEach(task => {
      (task.assignees || []).forEach(user => {
        if (user.id !== 'unassigned') {
          userMap.set(user.id, user);
        }
      });
    });
    return Array.from(userMap.values());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return (tasks || []).filter(task => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesId = task.displayId.toLowerCase().includes(query);
      const matchesAssignee = (task.assignees || []).some(
        a => a.name.toLowerCase().includes(query) || (a.login && a.login.toLowerCase().includes(query))
      );
      return matchesTitle || matchesId || matchesAssignee;
    });
  }, [tasks, searchQuery]);

  const groupFieldNamesById = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(projectFields.map(field => [field.id, field.name]));
  }, [projectFields]);

  const dashboardItems = useMemo(
    () => buildGroupBlocksFromOrderedTasks(
      applyFieldGroupPaths(filteredTasks, selectedGroupFieldIds, groupFieldNamesById),
      selectedProject?.title || t('dashboard.currentProject', 'Current Project'),
      new Set(collapsedGroupBlockIds)
    ),
    [filteredTasks, selectedGroupFieldIds, groupFieldNamesById, selectedProject?.title, collapsedGroupBlockIds, t]
  );

  const toggleGroupBlockCollapsed = useCallback((groupBlockId: string) => {
    setCollapsedGroupBlockIds(prev =>
      prev.includes(groupBlockId)
        ? prev.filter(id => id !== groupBlockId)
        : [...prev, groupBlockId]
    );
  }, []);

  const persistTaskGroupPath = useCallback(async (task: Task, groupPath: GroupPath) => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;
    const fieldId = dateSettingsRef.current.groupPathFieldId || task.projectFieldIds?.groupPath;
    if (!fieldId) return false;

    return updateProjectV2ItemField(
      selectedProject.id,
      task.itemId,
      fieldId,
      { text: serializeGroupPath(groupPath) },
      githubToken
    );
  }, [githubToken, selectedProject?.id]);

  const persistChangedGroupPaths = useCallback(async (oldTasks: Task[], nextTasks: Task[]) => {
    const oldTasksById = new Map(
      oldTasks.flatMap(task => {
        const entries: Array<[string, Task]> = [[task.id, task]];
        if (task.itemId) entries.push([task.itemId, task]);
        return entries;
      })
    );
    const changedTasks = nextTasks.filter((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasksById.get(getTaskOrderId(task))?.groupPath || oldTasks[index]?.groupPath)
    );

    for (const task of changedTasks) {
      const success = await persistTaskGroupPath(task, task.groupPath || []);
      if (!success) return false;
    }

    return true;
  }, [persistTaskGroupPath]);

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string): Promise<Task | null> => {
    console.log(`[DashboardTasks] 📡 Fetching single item: ${itemId}`);
    try {
      const json = await fetchGitHubGraphQL(GET_SINGLE_ITEM_QUERY, { itemId }, token);
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
  }, [updateSyncTime, selectedProject?.id, setTasks]);

  const fetchTaskComments = useCallback(async (taskId: string, contentId: string, token: string) => {
    if (!contentId || !token) return;
    
    // Check if we are already fetching comments for this task to avoid concurrent duplicate requests
    if (ongoingCommentFetchesRef.current[taskId]) {
      console.log(`[DashboardTasks] 💬 Already fetching comments for task ${taskId} (active request check), skipping duplicate call`);
      return;
    }
    
    ongoingCommentFetchesRef.current[taskId] = true;
    console.log(`[DashboardTasks] 💬 Starting paginated comment fetch for task: ${taskId}, contentId: ${contentId}`);
    
    setIsFetchingComments(prev => ({ ...prev, [taskId]: true }));
    
    try {
      let hasNextPage = true;
      let cursor: string | undefined = undefined;
      let pageCount = 0;
      
      while (hasNextPage) {
        pageCount++;
        console.log(`[DashboardTasks] 💬 Fetching page ${pageCount} of comments for ${taskId} (cursor: ${cursor || 'start'})`);
        
        const variables: Record<string, string | number | boolean | undefined> = { 
          nodeId: contentId,
          cursor
        };
        
        const json = await fetchGitHubGraphQL(GET_ISSUE_COMMENTS_QUERY, variables, token);
        
        const node = json.data?.node;
        const commentsData = node?.comments || (node?.__typename === 'Issue' || node?.__typename === 'PullRequest' ? node.comments : null);

        if (json.errors) {
          console.warn(`[DashboardTasks] GraphQL errors (possibly non-fatal) fetching comments for ${taskId}:`, json.errors);
          if (!node || !commentsData) {
            console.error(`[DashboardTasks] Fatal GraphQL error: comments data was not returned.`);
            break;
          }
        }
        
        if (!commentsData) {
          console.warn(`[DashboardTasks] ⚠️ No comments connection found on node for ${taskId}`);
          break;
        }
        
        const rawComments = commentsData.nodes || [];
        const mappedComments: TaskComment[] = rawComments
          .filter(Boolean)
          .map(mapGitHubCommentToTaskComment);
          
        console.log(`[DashboardTasks] 💬 Fetched ${mappedComments.length} comments in page ${pageCount}`);
        
        setTasks(prev => prev.map(t => {
          if (t.id === taskId || t.itemId === taskId) {
            const currentComments = pageCount === 1 ? [] : (t.comments || []);
            const existingIds = new Set(currentComments.map(c => c.id));
            const newComments = mappedComments.filter(c => !existingIds.has(c.id));
            return {
              ...t,
              comments: [...currentComments, ...newComments]
            };
          }
          return t;
        }));
        
        hasNextPage = commentsData.pageInfo?.hasNextPage || false;
        cursor = commentsData.pageInfo?.endCursor;
      }
      
      console.log(`[DashboardTasks] ✅ Finished comment fetch for task ${taskId}`);
    } catch (e) {
      console.error(`Failed to fetch comments for task ${taskId}:`, e);
    } finally {
      ongoingCommentFetchesRef.current[taskId] = false;
      setIsFetchingComments(prev => ({ ...prev, [taskId]: false }));
    }
  }, [setTasks]);

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

        const json = await fetchGitHubGraphQL(GET_PROJECT_TASKS_QUERY, variables, token);

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
            if (isBackground) {
              // Never blank a usable task list because a background refresh
              // failed; keep stale data and surface the failure non-modally.
              logDashboardEvent('[DashboardTasks] Background refresh failed', {
                refreshKind: 'full_project',
                projectId,
                reason: options?.reason,
                error: errorMessage,
              }, 'warn');
              showToast(t('dashboard.backgroundRefreshFailed', 'Failed to refresh tasks from GitHub. Showing the last known state.'), 'error');
            } else {
              setApiError(errorMessage);
              setTasks([]);
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
      }

      setProjectFields(allFields);
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
      console.error('Failed to fetch project tasks:', error);
      if (isBackground) {
        logDashboardEvent('[DashboardTasks] Background refresh failed', {
          refreshKind: 'full_project',
          projectId,
          reason: options?.reason,
          error: error.message,
        }, 'warn');
        showToast(t('dashboard.backgroundRefreshFailed', 'Failed to refresh tasks from GitHub. Showing the last known state.'), 'error');
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
  }, [updateSyncTime, t, projectAccountId, selectedProject?.id, setTasks, showToast]);

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[], skipRefresh = false) => {
    const task = tasksRef.current.find(t => t.id === taskId || t.itemId === taskId);
    if (!task || !task.contentId || !githubToken) return false;

    if (task.isDraft) {
      try {
        const res = await fetchGitHubGraphQL(UPDATE_DRAFT_ASSIGNEES_MUTATION, { id: task.contentId, assigneeIds: userIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        if (task.itemId && !skipRefresh) await fetchSingleProjectItem(task.itemId, githubToken);
        return true;
      } catch (e) {
        console.error('Update draft assignees failed:', e);
        return false;
      }
    }

    const currentIds = task.assignees.map(a => a.id).filter(id => id !== 'unassigned');
    const addedIds = userIds.filter(id => !currentIds.includes(id));
    const removedIds = currentIds.filter(id => !userIds.includes(id));

    if (addedIds.length === 0 && removedIds.length === 0) return true;

    try {
      let latestAssigneeNodes: GitHubAssignee[] | undefined;

      if (addedIds.length > 0) {
        const res = await fetchGitHubGraphQL(ADD_ASSIGNEES_MUTATION, { issueId: task.contentId, assigneeIds: addedIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.addAssigneesToAssignable?.assignable?.assignees?.nodes;
      }

      if (removedIds.length > 0) {
        const res = await fetchGitHubGraphQL(REMOVE_ASSIGNEES_MUTATION, { issueId: task.contentId, assigneeIds: removedIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.removeAssigneesFromAssignable?.assignable?.assignees?.nodes;
      }

      if (latestAssigneeNodes) {
        const updatedAssignees: User[] = latestAssigneeNodes.map((a: GitHubAssignee, idx: number) => ({
          id: a.id || a.login || 'unknown',
          name: a.name || a.login || 'Unknown',
          avatarUrl: a.avatarUrl,
          initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
          avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
        }));

        const now = Date.now();
        setTasks(prev => prev.map(t => 
          (t.id === taskId || t.itemId === taskId) ? { ...t, assignees: updatedAssignees, localUpdateTimestamp: now } : t
        ));
      }

      if (task.itemId && !skipRefresh) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      return true;
    } catch (e) {
      console.error('Update task assignees failed:', e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks]);

  const updateTaskStatus = useCallback(async (task: Task, status: TaskStatus, skipRefresh = false): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !task.projectFieldIds?.status || !task.statusOptions || !githubToken) return false;
    try {
      const optionId = task.statusOptions[status];
      if (!optionId) return false;

      const now = Date.now();
      const progress = /^(done|closed|completed|merged)$/i.test(status) ? 100 : /^(todo|backlog|open|not started)$/i.test(status) ? 0 : 50;
      setTasks(prev => prev.map(t => 
        (t.id === task.id || t.itemId === task.itemId) 
          ? { ...t, status, progress, localUpdateTimestamp: now } 
          : t
      ));

      const success = await updateProjectV2ItemField(selectedProject.id, task.itemId, task.projectFieldIds.status, { singleSelectOptionId: optionId }, githubToken);
      if (success && !skipRefresh) fetchSingleProjectItem(task.itemId, githubToken);
      return success;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, setTasks]);

  const updateTaskDates = useCallback(async (task: Task, startDate?: string | null, targetDate?: string, estimate?: number, estimateUnit?: string, autoUpdateStartDate?: AutoUpdateStartDateMode, skipRefresh = false): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;
    
    // Optimistic Update
    const oldTasks = [...tasksRef.current];
    const projectFixedMode = getProjectFixedStartDateMode(dateSettings);
    const shouldClearStartDate = startDate === null;
    const normalizedStartDate = shouldClearStartDate ? '' : startDate;
    let nextTasks: Task[] = [];
    let effectiveFixedMode = projectFixedMode;
    const updatedBeforeCascade = oldTasks.map(t => 
      (t.itemId === task.itemId || (t.contentId && t.contentId === task.contentId)) 
        ? { 
            ...t, 
            startDate: normalizedStartDate !== undefined ? normalizedStartDate : t.startDate,
            targetDate: (!shouldClearStartDate && (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined))
              ? calculateTargetDate(
                  normalizedStartDate !== undefined ? normalizedStartDate : t.startDate,
                  estimate !== undefined ? estimate : (t.estimate || 0),
                  estimateUnit !== undefined ? estimateUnit : (t.estimateUnit || 'days')
                )
              : t.targetDate,
            estimate: estimate !== undefined ? estimate : t.estimate,
            estimateUnit: estimateUnit !== undefined ? estimateUnit : t.estimateUnit,
            autoUpdateStartDate: autoUpdateStartDate !== undefined ? autoUpdateStartDate : t.autoUpdateStartDate,
            localUpdateTimestamp: (startDate !== undefined || targetDate !== undefined) ? Date.now() : t.localUpdateTimestamp,
            tempStartDate: startDate !== undefined ? undefined : t.tempStartDate,
            tempTargetDate: (startDate !== undefined || targetDate !== undefined) ? undefined : t.tempTargetDate
          } 
        : t
    );

    if (!shouldClearStartDate && projectFixedMode === 'ask') {
      const fixedStartDateCandidates = uniqueTasks(getFixedStartDateUpdateCandidates(updatedBeforeCascade, task.itemId));
      if (fixedStartDateCandidates.length > 0) {
        const decision = await requestStartDateDecision(fixedStartDateCandidates);
        effectiveFixedMode = decision === 'auto' ? 'auto' : 'ask';
      }
    }

    nextTasks = shouldClearStartDate
      ? recalculateFloatingSuccessorDates(updatedBeforeCascade, task.itemId, new Set(), effectiveFixedMode)
      : cascadeTaskDates(updatedBeforeCascade, task.itemId!, new Set(), {
          fixedStartDateMode: effectiveFixedMode,
        });
    const dependencyRepair = autoCorrectDependencyFields(nextTasks);
    nextTasks = dependencyRepair.tasks;
    setTasks(nextTasks);

    let anySuccess = false;
    try {
      const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
        if (!fieldId) return;
        const success = await updateProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, value, githubToken);
        if (success) anySuccess = true;
      };

      // Auto-calculate new target date if dependencies changed
      let finalTargetDate = targetDate;
      const effectiveStartDate = normalizedStartDate !== undefined ? normalizedStartDate : task.startDate;
      const effectiveEstimate = estimate !== undefined ? estimate : (task.estimate || 0);
      const effectiveUnit = estimateUnit !== undefined ? estimateUnit : (task.estimateUnit || 'days');
      
      if (!shouldClearStartDate && (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined)) {
        const calculated = calculateTargetDate(effectiveStartDate, effectiveEstimate, effectiveUnit);
        if (calculated !== task.targetDate) {
          finalTargetDate = calculated;
        }
      }

      if (shouldClearStartDate) {
        const fieldId = dateSettings.startDateFieldId || task.projectFieldIds?.startDate;
        if (fieldId) {
          const success = await clearProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, githubToken);
          if (success) anySuccess = true;
        }
      } else if (startDate) {
        const fieldId = dateSettings.startDateFieldId || task.projectFieldIds?.startDate;
        await updateField(fieldId, { date: formatToGitHubDate(startDate) });
      }
      if (finalTargetDate) {
        const fieldId = dateSettings.targetDateFieldId || task.projectFieldIds?.targetDate;
        await updateField(fieldId, { date: formatToGitHubDate(finalTargetDate) });
      }
      if (estimate !== undefined) {
        const fieldId = dateSettings.estimateFieldId || task.projectFieldIds?.estimate;
        await updateField(fieldId, { number: estimate });
      }
      if (estimateUnit !== undefined) {
        const fieldId = dateSettings.estimateUnitFieldId || task.projectFieldIds?.estimateUnit;
        if (fieldId) {
          const globalField = projectFields.find(f => f.id === fieldId);
          const isSingleSelect = 
            globalField?.dataType === 'SINGLE_SELECT' || 
            globalField?.__typename === 'ProjectV2SingleSelectField' ||
            (task.estimateUnitOptions && Object.keys(task.estimateUnitOptions).length > 0);

          if (isSingleSelect) {
            let optionId = task.estimateUnitOptions?.[estimateUnit];
            if (!optionId && globalField?.options) {
              const globalOption = globalField.options.find(o => o.name === estimateUnit);
              if (globalOption) optionId = globalOption.id;
            }
            if (optionId) await updateField(fieldId, { singleSelectOptionId: optionId });
          } else {
            await updateField(fieldId, { text: estimateUnit });
          }
        }
      }

      // Handle autoUpdateStartDate persistence if a field is configured
      if (autoUpdateStartDate !== undefined) {
        const fieldId = dateSettings.autoUpdateStartDateFieldId; // New setting
        if (fieldId) {
          await updateField(fieldId, { text: autoUpdateStartDate });
        }
      }

      if (anySuccess) {
        await persistDependencyFieldCorrections(dependencyRepair.corrections, nextTasks, selectedProject.id, githubToken, dateSettings);
        if (!skipRefresh) fetchSingleProjectItem(task.itemId, githubToken);
      } else {
        setTasks(oldTasks);
      }
      return anySuccess;
    } catch (e) {
      console.error(e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, dateSettings, projectFields, requestStartDateDecision, setTasks]);

  const updateTaskSuccessors = useCallback(async (taskId: string, successorIds: string[], skipRefresh = false, decision?: 'auto' | 'locked' | 'ask'): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken || !dateSettings.successorFieldId) return false;
    
    // 1. Identify the source task using the absolute latest ref
    const currentTasks = tasksRef.current;
    const task = currentTasks.find(t => t.itemId === taskId || t.id === taskId);
    if (!task || !task.itemId) return false;
    const sourceTaskId = task.itemId;
    const oldSuccessorIds = task.successorIds || [];
    const nextSuccessorIds = preserveUniqueIds(successorIds);
    const addedSuccessorIds = nextSuccessorIds.filter(successorId => !oldSuccessorIds.includes(successorId));
    const removedSuccessorIds = oldSuccessorIds.filter(successorId => !nextSuccessorIds.includes(successorId));
    const affectedSuccessorIds = preserveUniqueIds([...addedSuccessorIds, ...removedSuccessorIds]);

    // 2. Resolve prompt if needed
    const projectFixedMode = getProjectFixedStartDateMode(dateSettings);
    let effectiveFixedMode: FixedSuccessorStartDateMode = decision === 'auto'
      ? 'auto'
      : (decision === 'ask' || decision === 'locked') ? 'ask' : projectFixedMode;

    if (!decision && projectFixedMode === 'ask') {
      const successorsToAsk = currentTasks.filter(successor => 
        addedSuccessorIds.includes(successor.itemId || successor.id) &&
        shouldAskToUpdateFixedSuccessorStartDate(task, successor)
      );
      if (successorsToAsk.length > 0) {
        const promptDecision = await requestStartDateDecision(successorsToAsk);
        effectiveFixedMode = promptDecision === 'auto' ? 'auto' : 'ask';
      }
    }

    // 3. Synchronous State Calculation
    const oldTasks = [...tasksRef.current];
    
    // a. Update successors for the source task
    const dependencyEditTimestamp = Date.now();
    const updated = oldTasks.map(t => {
      const currentTaskId = t.itemId || t.id;
      if (currentTaskId === sourceTaskId) {
        return { ...t, successorIds: nextSuccessorIds, localUpdateTimestamp: dependencyEditTimestamp };
      }
      if (affectedSuccessorIds.includes(currentTaskId)) {
        const existingPredecessorIds = getExistingPredecessorIds(oldTasks, t);
        const predecessorIds = addedSuccessorIds.includes(currentTaskId)
          ? preserveUniqueIds([...existingPredecessorIds, sourceTaskId])
          : existingPredecessorIds.filter(predecessorId => predecessorId !== sourceTaskId);
        return {
          ...withUpdatedPredecessorIds(t, predecessorIds),
          localUpdateTimestamp: dependencyEditTimestamp,
        };
      }
      return t;
    });

    // b. Cascade dependency-derived dates into temp display fields.
    let nextTasks = cascadeTaskDates(updated, sourceTaskId, new Set(), {
      fixedStartDateMode: effectiveFixedMode,
    });

    for (const affectedSuccessorId of affectedSuccessorIds) {
      nextTasks = recalculateFloatingSuccessorDates(nextTasks, affectedSuccessorId, new Set(), effectiveFixedMode);
    }

    const dependencyRepair = removedSuccessorIds.length === 0
      ? autoCorrectDependencyFields(nextTasks)
      : { tasks: nextTasks, corrections: [] };
    nextTasks = dependencyRepair.tasks;
    
    // 4. Atomic Update (synchronous to the ref via our wrapper)
    setTasks(nextTasks);

    // 5. Persistence
    try {
      const sourceSuccessorsTextValue = nextSuccessorIds.join(',');
      let success = await updateProjectV2ItemField(
        selectedProject.id, 
        sourceTaskId, 
        dateSettings.successorFieldId, 
        { text: sourceSuccessorsTextValue }, 
        githubToken
      );

      const predecessorFieldId = dateSettings.predecessorFieldId;
      if (success && predecessorFieldId) {
        for (const affectedSuccessorId of affectedSuccessorIds) {
          const affectedTask = nextTasks.find(t => (t.itemId || t.id) === affectedSuccessorId);
          if (!affectedTask?.itemId) continue;
          const predecessorsTextValue = (affectedTask.predecessorIds || []).join(',');
          const predecessorSuccess = await updateProjectV2ItemField(
            selectedProject.id,
            affectedTask.itemId,
            predecessorFieldId,
            { text: predecessorsTextValue },
            githubToken
          );
          success = success && predecessorSuccess;
        }
      }

      if (success) {
        await persistDependencyFieldCorrections(dependencyRepair.corrections, nextTasks, selectedProject.id, githubToken, dateSettings);
      }

      if (success) {
        if (!skipRefresh) fetchSingleProjectItem(sourceTaskId, githubToken);
      } else {
        // Rollback to precisely what we had before this specific operation started
        setTasks(oldTasks);
      }
      return success;
    } catch (e) {
      console.error('[DashboardTasks] updateTaskSuccessors failed:', e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, dateSettings, requestStartDateDecision, fetchSingleProjectItem, setTasks]);

  const updateTaskGroupPath = useCallback(async (taskId: string, groupPath: GroupPath): Promise<boolean> => {
    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || t.itemId === taskId);
    if (!task) return false;

    const nextTasks = oldTasks.map(t =>
      (t.id === task.id || t.itemId === task.itemId)
        ? { ...t, groupPath: [...groupPath], localUpdateTimestamp: Date.now() }
        : t
    );

    setTasks(nextTasks);
    const success = await persistTaskGroupPath(task, groupPath);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [persistTaskGroupPath, setTasks, showToast, t, updateSyncTime]);

  const renameGroupBlock = useCallback(async (groupBlockId: string, name: string): Promise<boolean> => {
    const groupBlock = dashboardItems.find(item => isTaskGroupBlock(item) && item.groupBlockId === groupBlockId);
    if (!groupBlock || !isTaskGroupBlock(groupBlock)) return false;
    if (!groupBlock || groupBlock.isSyntheticRoot) return false;

    const oldTasks = [...tasksRef.current];
    const renamedTasks = renameGroupBlockInTasks(oldTasks, groupBlock, name);
    const timestamp = Date.now();
    const nextTasks = renamedTasks.map((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasks[index]?.groupPath)
        ? { ...task, localUpdateTimestamp: timestamp }
        : task
    );

    setTasks(nextTasks);
    const success = await persistChangedGroupPaths(oldTasks, nextTasks);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [dashboardItems, persistChangedGroupPaths, setTasks, showToast, t, updateSyncTime]);

  const ungroupGroupBlock = useCallback(async (groupBlockId: string): Promise<boolean> => {
    const groupBlock = dashboardItems.find(item => isTaskGroupBlock(item) && item.groupBlockId === groupBlockId);
    if (!groupBlock || !isTaskGroupBlock(groupBlock)) return false;
    if (!groupBlock || groupBlock.isSyntheticRoot) return false;

    const oldTasks = [...tasksRef.current];
    const ungroupedTasks = ungroupGroupBlockInTasks(oldTasks, groupBlock);
    const timestamp = Date.now();
    const nextTasks = ungroupedTasks.map((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasks[index]?.groupPath)
        ? { ...task, localUpdateTimestamp: timestamp }
        : task
    );

    setTasks(nextTasks);
    const success = await persistChangedGroupPaths(oldTasks, nextTasks);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [dashboardItems, persistChangedGroupPaths, setTasks, showToast, t, updateSyncTime]);

  const reorderTask = useCallback(async (taskId: string, afterTaskId: string | null): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || getTaskOrderId(t) === taskId);
    if (!task?.itemId) return false;

    const nextTasks = moveTaskAfter(oldTasks, getTaskOrderId(task), afterTaskId);
    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    if (oldOrder === nextOrder) return true;

    logDashboardEvent('[DashboardTasks] Reorder started', {
      reorderKind: 'single_task',
      projectId: selectedProject.id,
      taskId,
      itemId: task.itemId,
      afterTaskId,
    });
    setTasks(nextTasks);
    const success = await updateProjectV2ItemPosition(selectedProject.id, task.itemId, afterTaskId, githubToken);
    if (success) {
      logDashboardEvent('[DashboardTasks] Reorder completed', {
        reorderKind: 'single_task',
        projectId: selectedProject.id,
        movedItemIds: [task.itemId],
        afterTaskId,
      });
      markRecentLocalReorder([task.itemId]);
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Reorder failed', {
      reorderKind: 'single_task',
      projectId: selectedProject.id,
      movedItemIds: [task.itemId],
      afterTaskId,
    }, 'warn');
    showToast(t('dashboard.taskReorderFailed', 'Failed to reorder task.'), 'error');
    return false;
  }, [selectedProject?.id, githubToken, setTasks, markRecentLocalReorder, updateSyncTime, showToast, t]);

  const reorderTaskBlock = useCallback(async (taskIds: string[], afterTaskId: string | null): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const nextTasks = moveTaskBlockAfter(oldTasks, taskIds, afterTaskId);
    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    if (oldOrder === nextOrder) return true;

    const movedTasks = taskIds
      .map(taskId => nextTasks.find(task => task.id === taskId || getTaskOrderId(task) === taskId))
      .filter((task): task is Task => Boolean(task?.itemId));
    if (movedTasks.length !== taskIds.length) return false;

    logDashboardEvent('[DashboardTasks] Reorder started', {
      reorderKind: 'task_block',
      projectId: selectedProject.id,
      taskIds,
      movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
      afterTaskId,
    });
    setTasks(nextTasks);

    let success = true;
    let currentAfterId = afterTaskId;
    for (const movedTask of movedTasks) {
      const moved = await updateProjectV2ItemPosition(selectedProject.id, movedTask.itemId!, currentAfterId, githubToken);
      if (!moved) {
        success = false;
        break;
      }
      currentAfterId = movedTask.itemId!;
    }

    if (success) {
      logDashboardEvent('[DashboardTasks] Reorder completed', {
        reorderKind: 'task_block',
        projectId: selectedProject.id,
        movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
        afterTaskId,
      });
      markRecentLocalReorder(movedTasks.map(movedTask => movedTask.itemId!));
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Reorder failed', {
      reorderKind: 'task_block',
      projectId: selectedProject.id,
      movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
      afterTaskId,
      fallbackRefreshKind: 'full_project',
    }, 'warn');
    showToast(t('dashboard.taskReorderFailed', 'Failed to reorder task.'), 'error');
    await fetchProjectTasks(selectedProject.id, githubToken, { mode: 'background', reason: 'fallback', preserveViewport: true });
    return false;
  }, [selectedProject?.id, githubToken, setTasks, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks]);

  const moveTaskToGroupPath = useCallback(async (
    taskId: string,
    groupPath: GroupPath,
    afterTaskId: string | null,
    fieldValueChanges: DashboardFieldValueChange[] = []
  ): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || getTaskOrderId(t) === taskId);
    if (!task?.itemId) return false;

    const taskOrderId = getTaskOrderId(task);
    const timestamp = Date.now();
    const groupedTasks = moveTasksToGroupPath(oldTasks, [taskOrderId], groupPath).map(candidate =>
      getTaskOrderId(candidate) === taskOrderId || candidate.id === task.id
        ? {
            ...applyTaskFieldValueChanges(candidate, fieldValueChanges),
            localUpdateTimestamp: timestamp,
          }
        : candidate
    );
    const nextTasks = moveTaskAfter(groupedTasks, taskOrderId, afterTaskId);
    const nextTask = nextTasks.find(t => t.id === task.id || getTaskOrderId(t) === taskOrderId);
    if (!nextTask) return false;

    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    const orderChanged = oldOrder !== nextOrder;
    const groupPathChanged = serializeGroupPath(task.groupPath) !== serializeGroupPath(nextTask.groupPath);
    const fieldValuesChanged = fieldValueChanges.some(change =>
      (task.projectFieldValues?.[change.fieldId] || '') !== change.value
    );
    if (!orderChanged && !groupPathChanged && !fieldValuesChanged) return true;

    logDashboardEvent('[DashboardTasks] Move task to group started', {
      projectId: selectedProject.id,
      taskId,
      itemId: task.itemId,
      targetGroupPath: groupPath,
      fieldValueChanges,
      afterTaskId,
      orderChanged,
      groupPathChanged,
      fieldValuesChanged,
    });

    setTasks(nextTasks);

    let success = true;
    for (const change of fieldValueChanges) {
      if (!success) break;
      if ((task.projectFieldValues?.[change.fieldId] || '') === change.value) continue;
      const field = projectFields.find(candidate => candidate.id === change.fieldId);
      if (change.value === '') {
        success = await clearProjectV2ItemField(selectedProject.id, task.itemId, change.fieldId, githubToken);
      } else {
        success = await updateProjectV2ItemField(
          selectedProject.id,
          task.itemId,
          change.fieldId,
          getProjectFieldUpdateValue(field, change.value),
          githubToken
        );
      }
    }

    if (success && groupPathChanged) {
      success = await persistTaskGroupPath(nextTask, nextTask.groupPath || []);
    }

    if (success && orderChanged) {
      success = await updateProjectV2ItemPosition(selectedProject.id, task.itemId, afterTaskId, githubToken);
    }

    if (success) {
      logDashboardEvent('[DashboardTasks] Move task to group completed', {
        projectId: selectedProject.id,
        movedItemIds: [task.itemId],
        targetGroupPath: groupPath,
        fieldValueChanges,
        afterTaskId,
      });
      if (orderChanged) {
        markRecentLocalReorder([task.itemId]);
      }
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Move task to group failed', {
      projectId: selectedProject.id,
      movedItemIds: [task.itemId],
      targetGroupPath: groupPath,
      fieldValueChanges,
      afterTaskId,
      fallbackRefreshKind: (groupPathChanged || fieldValuesChanged) && orderChanged ? 'full_project' : undefined,
    }, 'warn');
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    if ((groupPathChanged || fieldValuesChanged) && orderChanged) {
      await fetchProjectTasks(selectedProject.id, githubToken, { mode: 'background', reason: 'fallback', preserveViewport: true });
    }
    return false;
  }, [selectedProject?.id, githubToken, setTasks, projectFields, persistTaskGroupPath, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks]);

  const handleCreateTask = useCallback(async (taskData: {
    title: string;
    body?: string;
    status?: string;
    startDate?: string;
    targetDate?: string;
    estimate?: number;
    estimateUnit?: string;
    autoUpdateStartDate?: AutoUpdateStartDateMode;
    assigneeIds?: string[];
    insertPosition?: TaskInsertPosition | null;
  }): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) {
      console.error('No project selected or token available');
      return false;
    }

    const { title, body, status, startDate, targetDate, estimate, estimateUnit, autoUpdateStartDate, assigneeIds, insertPosition } = taskData;
    const createdGroupPath = insertPosition?.groupPath;

    try {
      let repoNameWithOwner: string | null = null;
      if (tasksRef.current.length > 0 && tasksRef.current[0].repository) {
        repoNameWithOwner = tasksRef.current[0].repository;
      }

      let itemId: string | null = null;
      let contentId: string | null = null;

      if (repoNameWithOwner) {
        const [owner, repo] = repoNameWithOwner.split('/');
        const repositoryId = await getRepositoryId(owner, repo, githubToken);

        if (repositoryId) {
          contentId = await createGitHubIssue(repositoryId, title, body, githubToken);
          if (contentId) {
            itemId = await addProjectV2Item(selectedProject.id, contentId, githubToken);
          }
        }
      }

      if (!itemId) {
        itemId = await addProjectV2DraftIssue(selectedProject.id, title, body, githubToken);
      }

      if (!itemId) {
        console.error('Failed to create task');
        return false;
      }

      const tempTask: Task = {
        id: itemId,
        displayId: itemId.slice(-6),
        itemId: itemId,
        contentId: contentId || undefined,
        title,
        status: 'Todo',
        startDate: '',
        targetDate: '',
        estimate: estimate || 0,
        estimateUnit: estimateUnit,
        assignees: [],
        progress: 0,
        projectFieldIds: tasksRef.current.length > 0 ? tasksRef.current[0].projectFieldIds : undefined,
        statusOptions: tasksRef.current.length > 0 ? tasksRef.current[0].statusOptions : undefined,
        autoUpdateStartDate: autoUpdateStartDate,
        groupPath: createdGroupPath ? [...createdGroupPath] : [],
      };

      if (status && tempTask.statusOptions) {
        await updateTaskStatus(tempTask, status, true);
      }
      if (startDate || targetDate || estimate !== undefined || estimateUnit !== undefined || autoUpdateStartDate !== undefined) {
        await updateTaskDates(tempTask, startDate, targetDate, estimate, estimateUnit, autoUpdateStartDate, true);
      }
      if (assigneeIds && assigneeIds.length > 0 && contentId) {
        await updateTaskAssignees(itemId, assigneeIds, true);
      }
      if (createdGroupPath) {
        await persistTaskGroupPath(tempTask, createdGroupPath);
      }

      let positionedAfterId: string | null | undefined;
      const afterId = insertPosition
        ? getAfterIdForInsertPosition(tasksRef.current, insertPosition)
        : getAfterIdForAppend(tasksRef.current);
      if (insertPosition || afterId !== null) {
        const moved = await updateProjectV2ItemPosition(selectedProject.id, itemId, afterId, githubToken);
        if (!moved) {
          showToast(t('dashboard.taskInsertPositionFailed', 'Task was created, but could not be moved to the requested position.'), 'error');
        } else {
          positionedAfterId = afterId;
        }
      }

      console.log(`[DashboardTasks] 🚀 Creation sequence complete, performing final fetch for: ${itemId}`);
      const fetchedTask = await fetchSingleProjectItem(itemId, githubToken);
      if (positionedAfterId !== undefined) {
        setTasks(prev => upsertTaskAfter(prev, fetchedTask || tempTask, positionedAfterId));
      }
      
      setIsCreateMode(false);
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, updateTaskStatus, updateTaskDates, updateTaskAssignees, persistTaskGroupPath, setTasks, setIsCreateMode, showToast, t]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => 
        (t.id === task.id || t.itemId === task.itemId)
          ? { ...t, title, localUpdateTimestamp: now }
          : t
      ));
      const mutation = task.isDraft ? UPDATE_DRAFT_TITLE_MUTATION : UPDATE_ISSUE_TITLE_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, title }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) await fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks]);

  const updateTaskDescription = useCallback(async (task: Task, description: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => 
        (t.id === task.id || t.itemId === task.itemId)
          ? { ...t, body: description, localUpdateTimestamp: now }
          : t
      ));
      const mutation = task.isDraft ? UPDATE_DRAFT_BODY_MUTATION : UPDATE_ISSUE_BODY_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, body: description }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) await fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks]);

  const updateTaskComment = useCallback(async (task: Task, commentId: string, body: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = (t.comments || []).map(c => 
            c.id === commentId ? { ...c, body } : c
          );
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));
      const res = await fetchGitHubGraphQL(UPDATE_ISSUE_COMMENT_MUTATION, { id: commentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  const deleteTaskComment = useCallback(async (task: Task, commentId: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = (t.comments || []).filter(c => c.id !== commentId);
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));
      const res = await fetchGitHubGraphQL(DELETE_ISSUE_COMMENT_MUTATION, { id: commentId }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  const addTaskComment = useCallback(async (task: Task, body: string): Promise<boolean> => {
    if (!task.contentId || !githubToken || task.isDraft) return false;
    try {
      const res = await fetchGitHubGraphQL(ADD_ISSUE_COMMENT_MUTATION, { subjectId: task.contentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);

      const addedNode = res.data?.addComment?.commentEdge?.node;
      const authorLogin = addedNode?.author?.login || 'me';
      const authorName = addedNode?.author?.name || authorLogin;
      const authorAvatar = addedNode?.author?.avatarUrl;

      const newComment: TaskComment = {
        id: addedNode?.id || `comment-local-${Date.now()}`,
        body: addedNode?.body || body,
        createdAt: addedNode?.createdAt || new Date().toISOString(),
        author: {
          id: authorLogin,
          login: authorLogin,
          name: authorName,
          avatarUrl: authorAvatar,
          initials: authorName.substring(0, 2).toUpperCase(),
          avatarColor: 'bg-slate-100 text-slate-500',
        }
      };

      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = [...(t.comments || []), newComment];
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));

      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  const deleteTask = useCallback(async (task: Task): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    try {
      if (task.contentId && !task.isDraft) {
        const issueRes = await fetchGitHubGraphQL(
          DELETE_ISSUE_MUTATION,
          { issueId: task.contentId },
          githubToken
        );
        if (issueRes.errors) throw new Error(issueRes.errors[0]?.message);
      }

      const projectItemRes = await fetchGitHubGraphQL(
        DELETE_PROJECT_ITEM_MUTATION,
        { projectId: selectedProject.id, itemId: task.itemId },
        githubToken
      );
      if (projectItemRes.errors) {
        const message = projectItemRes.errors[0]?.message || '';
        if (!message.toLowerCase().includes('not found') && !message.toLowerCase().includes('could not resolve')) {
          throw new Error(message);
        }
      }

      setTasks(prev => prev.filter(t => t.itemId !== task.itemId && t.id !== task.id));
      updateSyncTime();
      return true;
    } catch (e) {
      console.error('Delete task failed:', e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, setTasks, updateSyncTime]);

  const fetchSearchUsers = useCallback(async (searchTerm: string, repository?: string): Promise<User[]> => {
    if (!githubToken) return [];

    try {
      const resultsMap = new Map<string, User>();

      const currentAccount = githubAccounts.find(a => a.id === projectAccountId);
      if (currentAccount && currentAccount.nodeId) {
        const currentUser: User = {
          id: currentAccount.nodeId,
          login: currentAccount.login,
          name: (currentAccount.name || currentAccount.login) + ` (${t('common.me', 'Me')})`,
          avatarUrl: currentAccount.avatarUrl,
          initials: (currentAccount.name || currentAccount.login || '??').substring(0, 2).toUpperCase(),
          avatarColor: 'bg-primary/20 text-primary',
        };
        resultsMap.set(currentUser.id, currentUser);
      }

      if (repository) {
        const [owner, name] = repository.split('/');
        if (owner && name) {
          const assignableJson = await fetchGitHubGraphQL(SEARCH_ASSIGNABLE_USERS_QUERY, { owner, name, query: searchTerm || undefined }, githubToken);
          const assignableNodes = (assignableJson.data?.repository?.assignableUsers?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;
          
          assignableNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      const currentOwner = projectsData.find(o => o.projects.some(p => p.id === selectedProject?.id));

      if (!searchTerm && !repository && currentOwner) {
        if (currentOwner.isOrg) {
          const orgJson = await fetchGitHubGraphQL(SEARCH_ORG_MEMBERS_QUERY, { login: currentOwner.login }, githubToken);
          const orgNodes = (orgJson.data?.organization?.membersWithRole?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;
          
          orgNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      if (searchTerm && searchTerm.length >= 2) {
        let shouldGlobalSearch = false;
        let queryStr = searchTerm;

        if (currentOwner?.isOrg) {
          shouldGlobalSearch = true;
          queryStr = `org:${currentOwner.login} ${searchTerm}`;
        } else if (currentOwner && selectedProject?.public) {
          shouldGlobalSearch = true;
          queryStr = `${searchTerm}`;
        }

        if (shouldGlobalSearch) {
          const globalJson = await fetchGitHubGraphQL(SEARCH_GLOBAL_USERS_QUERY, { searchQuery: queryStr }, githubToken);
          const globalNodes = (globalJson.data?.search?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;
          
          globalNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      return Array.from(resultsMap.values());
    } catch (e) {
      console.error('Search users failed:', e);
      return [];
    }
  }, [githubToken, projectsData, selectedProject, projectAccountId, githubAccounts, t]);

  return {
    tasks,
    dashboardItems,
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
    setTasks,
    isLoadingTasks,
    isRefreshingTasks,
    setIsLoadingTasks,
    searchQuery,
    setSearchQuery,
    projectStatusOptions,
    setProjectStatusOptions,
    projectFields,
    fieldsProgress,
    apiError,
    availableUsers,
    filteredTasks,
    fetchProjectTasks,
    fetchSingleProjectItem,
    updateTaskAssignees,
    updateTaskStatus,
    updateTaskDates,
    updateTaskSuccessors,
    updateTaskGroupPath,
    renameGroupBlock,
    ungroupGroupBlock,
    toggleGroupBlockCollapsed,
    reorderTask,
    reorderTaskBlock,
    moveTaskToGroupPath,
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    deleteTask,
    fetchSearchUsers,
    fetchTaskComments,
    isFetchingComments,
  };
}
