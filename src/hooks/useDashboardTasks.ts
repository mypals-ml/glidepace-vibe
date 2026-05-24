import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, getRepositoryId, createGitHubIssue, addProjectV2Item, addProjectV2DraftIssue, updateProjectV2ItemField, clearProjectV2ItemField, updateProjectV2ItemPosition } from '../lib/githubService';
import { mapProjectItemToTask } from '../lib/githubTaskMapper';
import { formatToGitHubDate, calculateTargetDate } from '../lib/dateUtils';
import { registerStatuses } from '../utils/statusColors';
import { autoCorrectDependencyFields, cascadeTaskDates, cascadeAllTasks, getFixedStartDateUpdateCandidates, recalculateFloatingSuccessorDates, shouldAskToUpdateFixedSuccessorStartDate, withUpdatedPredecessorIds } from '../lib/taskDependencyUtils';
import { getAfterIdForInsertPosition, getTaskOrderId, moveTaskAfter, moveTaskBlockAfter } from '../lib/taskOrderUtils';
import { buildGroupBlocksFromOrderedTasks, renameGroupBlock as renameGroupBlockInTasks, serializeGroupPath, ungroupGroupBlock as ungroupGroupBlockInTasks, isTaskGroupBlock, moveTasksToGroupPath } from '../lib/taskGroupUtils';
import type { DependencyFieldCorrection } from '../lib/taskDependencyUtils';
import { mergeFetchedTaskWithLocalState } from '../lib/taskMergeUtils';
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
  DELETE_ISSUE_MUTATION
} from '../lib/githubQueries';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, GitHubProjectItem, GitHubProjectV2Field, GitHubAssignee, ProjectDateSettings, AutoUpdateStartDateMode, FixedSuccessorStartDateMode, TaskInsertPosition, GroupPath } from '../types';

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

function sortUniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean))).sort();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
  const [projectFields, setProjectFields] = useState<GitHubProjectV2Field[]>([]);
  const [fieldsProgress, setFieldsProgress] = useState<{ current: number; total: number; isFetching: boolean }>({ current: 0, total: 0, isFetching: false });
  const [apiError, setApiError] = useState<string | null>(null);
  const [collapsedGroupBlockIds, setCollapsedGroupBlockIds] = useState<string[]>([]);
  
  const dateSettingsRef = useRef(dateSettings);
  useEffect(() => {
    dateSettingsRef.current = dateSettings;
  }, [dateSettings]);

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

  const dashboardItems = useMemo(
    () => buildGroupBlocksFromOrderedTasks(
      filteredTasks,
      selectedProject?.title || t('dashboard.currentProject', 'Current Project'),
      new Set(collapsedGroupBlockIds)
    ),
    [filteredTasks, selectedProject?.title, collapsedGroupBlockIds, t]
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

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
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
        const currentTasks = tasksRef.current;
        const index = currentTasks.findIndex(t => t.itemId === updatedTask.itemId || t.contentId === updatedTask.contentId);
        const mergedTasks = index === -1 ? [...currentTasks, updatedTask] : [...currentTasks];
        if (index !== -1) {
          mergedTasks[index] = mergeFetchedTaskWithLocalState(mergedTasks[index], updatedTask);
        }
        const dependencyRepair = autoCorrectDependencyFields(mergedTasks);
        const cascadedTasks = cascadeTaskDates(dependencyRepair.tasks, updatedTask.itemId || updatedTask.id, new Set(), {
          fixedStartDateMode: getProjectFixedStartDateMode(dateSettingsRef.current),
        });
        setTasks(cascadedTasks);
        if (selectedProject?.id) {
          await persistDependencyFieldCorrections(dependencyRepair.corrections, cascadedTasks, selectedProject.id, token, dateSettingsRef.current);
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
      } else {
        console.warn(`[DashboardTasks] ⚠️ No item data returned for ${itemId}`);
      }
    } catch (e) {
      console.error('Failed to fetch single project item:', e);
    }
  }, [updateSyncTime, selectedProject?.id, setTasks]);

  const fetchProjectTasks = useCallback(async (projectId: string, token: string) => {
    setIsLoadingTasks(true);
    setFieldsProgress({ current: 0, total: 0, isFetching: true });
    logDashboardEvent('[DashboardTasks] Refresh started', {
      refreshKind: 'full_project',
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

        if (json.errors) {
          console.error('GraphQL Errors fetching items:', JSON.stringify(json.errors, null, 2));
          setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
          setTasks([]);
          return;
        }

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
  
      const mappedTasks: Task[] = allItems.map(item => mapProjectItemToTask(item, dateSettingsRef.current));
      logDashboardEvent('[DashboardTasks] Refresh completed', {
        refreshKind: 'full_project',
        projectId,
        refreshedItemCount: mappedTasks.length,
        refreshedFieldCount: allFields.length,
      });

      const statusField = allFields.find((f: GitHubProjectV2Field) => f.name?.toLowerCase() === 'status');
      const statusOptions = (statusField?.options || []) as Array<{ name: string, color?: string }>;

      if (statusOptions.length > 0) {
        registerStatuses(statusOptions);
        setProjectStatusOptions(statusOptions.map(o => o.name));
      }

      const dependencyRepair = autoCorrectDependencyFields(mappedTasks);
      const cascadedTasks = cascadeAllTasks(dependencyRepair.tasks, {
        fixedStartDateMode: getProjectFixedStartDateMode(dateSettingsRef.current),
      });
      setProjectFields(allFields);
      setTasks(cascadedTasks);
      if (selectedProject?.id) {
        await persistDependencyFieldCorrections(dependencyRepair.corrections, cascadedTasks, selectedProject.id, token, dateSettingsRef.current);
      }
      updateSyncTime();

      // Auto-sync missing values for Done tasks
      mappedTasks.forEach(task => {
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
      setApiError(error.message || t('dashboard.unknownError'));
    } finally {
      setIsLoadingTasks(false);
      setFieldsProgress(prev => ({ ...prev, isFetching: false }));
    }
  }, [updateSyncTime, t, projectAccountId, selectedProject?.id, setTasks]);

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

        setTasks(prev => prev.map(t => 
          (t.id === taskId || t.itemId === taskId) ? { ...t, assignees: updatedAssignees } : t
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
      const success = await updateProjectV2ItemField(selectedProject.id, task.itemId, task.projectFieldIds.status, { singleSelectOptionId: optionId }, githubToken);
      if (success && !skipRefresh) fetchSingleProjectItem(task.itemId, githubToken);
      return success;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem]);

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
    const nextSuccessorIds = sortUniqueIds(successorIds);
    const addedSuccessorIds = nextSuccessorIds.filter(successorId => !oldSuccessorIds.includes(successorId));
    const removedSuccessorIds = oldSuccessorIds.filter(successorId => !nextSuccessorIds.includes(successorId));
    const affectedSuccessorIds = sortUniqueIds([...addedSuccessorIds, ...removedSuccessorIds]);

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
          ? sortUniqueIds([...existingPredecessorIds, sourceTaskId])
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
    await fetchProjectTasks(selectedProject.id, githubToken);
    return false;
  }, [selectedProject?.id, githubToken, setTasks, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks]);

  const moveTaskToGroupPath = useCallback(async (taskId: string, groupPath: GroupPath, afterTaskId: string | null): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || getTaskOrderId(t) === taskId);
    if (!task?.itemId) return false;

    const taskOrderId = getTaskOrderId(task);
    const groupedTasks = moveTasksToGroupPath(oldTasks, [taskOrderId], groupPath);
    const nextTasks = moveTaskAfter(groupedTasks, taskOrderId, afterTaskId);
    const nextTask = nextTasks.find(t => t.id === task.id || getTaskOrderId(t) === taskOrderId);
    if (!nextTask) return false;

    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    const orderChanged = oldOrder !== nextOrder;
    const groupPathChanged = serializeGroupPath(task.groupPath) !== serializeGroupPath(nextTask.groupPath);
    if (!orderChanged && !groupPathChanged) return true;

    logDashboardEvent('[DashboardTasks] Move task to group started', {
      projectId: selectedProject.id,
      taskId,
      itemId: task.itemId,
      targetGroupPath: groupPath,
      afterTaskId,
      orderChanged,
      groupPathChanged,
    });

    setTasks(nextTasks);

    let success = true;
    if (groupPathChanged) {
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
      afterTaskId,
      fallbackRefreshKind: groupPathChanged && orderChanged ? 'full_project' : undefined,
    }, 'warn');
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    if (groupPathChanged && orderChanged) {
      await fetchProjectTasks(selectedProject.id, githubToken);
    }
    return false;
  }, [selectedProject?.id, githubToken, setTasks, persistTaskGroupPath, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks]);

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

      let positionedAfterId: string | null | undefined;
      if (insertPosition) {
        const afterId = getAfterIdForInsertPosition(tasksRef.current, insertPosition);
        const moved = await updateProjectV2ItemPosition(selectedProject.id, itemId, afterId, githubToken);
        if (!moved) {
          showToast(t('dashboard.taskInsertPositionFailed', 'Task was created, but could not be moved to the requested position.'), 'error');
        } else {
          positionedAfterId = afterId;
        }
      }

      console.log(`[DashboardTasks] 🚀 Creation sequence complete, performing final fetch for: ${itemId}`);
      await fetchSingleProjectItem(itemId, githubToken);
      if (positionedAfterId !== undefined) {
        setTasks(prev => moveTaskAfter(prev, itemId, positionedAfterId));
      }
      
      setIsCreateMode(false);
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, updateTaskStatus, updateTaskDates, updateTaskAssignees, setTasks, setIsCreateMode, showToast, t]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const mutation = task.isDraft ? UPDATE_DRAFT_TITLE_MUTATION : UPDATE_ISSUE_TITLE_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, title }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const updateTaskDescription = useCallback(async (task: Task, description: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const mutation = task.isDraft ? UPDATE_DRAFT_BODY_MUTATION : UPDATE_ISSUE_BODY_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, body: description }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const updateTaskComment = useCallback(async (task: Task, commentId: string, body: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const res = await fetchGitHubGraphQL(UPDATE_ISSUE_COMMENT_MUTATION, { id: commentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const deleteTaskComment = useCallback(async (task: Task, commentId: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const res = await fetchGitHubGraphQL(DELETE_ISSUE_COMMENT_MUTATION, { id: commentId }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const addTaskComment = useCallback(async (task: Task, body: string): Promise<boolean> => {
    if (!task.contentId || !githubToken || task.isDraft) return false;
    try {
      const res = await fetchGitHubGraphQL(ADD_ISSUE_COMMENT_MUTATION, { subjectId: task.contentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

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
    setTasks,
    isLoadingTasks,
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
  };
}
