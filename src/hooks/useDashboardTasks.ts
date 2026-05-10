import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, getRepositoryId, createGitHubIssue, addProjectV2Item, addProjectV2DraftIssue, updateProjectV2ItemField } from '../lib/githubService';
import { mapProjectItemToTask } from '../lib/githubTaskMapper';
import { formatToGitHubDate, calculateTargetDate } from '../lib/dateUtils';
import { registerStatuses } from '../utils/statusColors';
import { cascadeTaskDates, cascadeAllTasks } from '../lib/taskDependencyUtils';
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
  ADD_ISSUE_COMMENT_MUTATION
} from '../lib/githubQueries';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, GitHubProjectItem, GitHubProjectV2Field, GitHubAssignee, ProjectDateSettings, AutoUpdateStartDateMode } from '../types';

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
}: UseDashboardTasksProps) {
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
  const [projectFields, setProjectFields] = useState<GitHubProjectV2Field[]>([]);
  const [fieldsProgress, setFieldsProgress] = useState<{ current: number; total: number; isFetching: boolean }>({ current: 0, total: 0, isFetching: false });
  const [apiError, setApiError] = useState<string | null>(null);

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

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    console.log(`[DashboardTasks] 📡 Fetching single item: ${itemId}`);
    try {
      const json = await fetchGitHubGraphQL(GET_SINGLE_ITEM_QUERY, { itemId }, token);
      console.log(`[DashboardTasks] 📥 GraphQL Response for ${itemId}:`, json);
      const itemData = json.data?.node as GitHubProjectItem;

      if (itemData) {
        const updatedTask = mapProjectItemToTask(itemData, dateSettings);
        console.log(`[DashboardTasks] ✅ Mapped Task for ${itemId}:`, {
          title: updatedTask.title,
          status: updatedTask.status,
          isDraft: updatedTask.isDraft,
          contentId: updatedTask.contentId
        });
        setTasks(prevTasks => {
          const index = prevTasks.findIndex(t => t.itemId === updatedTask.itemId || t.contentId === updatedTask.contentId);
          const result = index !== -1 
            ? prevTasks.map((t, i) => i === index ? updatedTask : t)
            : [...prevTasks, updatedTask];
          
          return cascadeTaskDates(result, updatedTask.itemId || updatedTask.id);
        });
        updateSyncTime();

        // Auto-sync missing values for Done tasks
        if (updatedTask.progress === 100 && updatedTask.itemId && selectedProject?.id) {
          const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
            if (fieldId) await updateProjectV2ItemField(selectedProject.id, updatedTask.itemId!, fieldId, value, token);
          };
          if (!updatedTask.startDate && updatedTask.tempStartDate) {
            updateField(dateSettings.startDateFieldId || updatedTask.projectFieldIds?.startDate, { date: formatToGitHubDate(updatedTask.tempStartDate) });
          }
          if (!updatedTask.targetDate && updatedTask.tempTargetDate) {
            updateField(dateSettings.targetDateFieldId || updatedTask.projectFieldIds?.targetDate, { date: formatToGitHubDate(updatedTask.tempTargetDate) });
          }
          if (updatedTask.estimate === undefined && updatedTask.tempEstimate !== undefined) {
            updateField(dateSettings.estimateFieldId || updatedTask.projectFieldIds?.estimate, { number: updatedTask.tempEstimate });
          }
        }
      } else {
        console.warn(`[DashboardTasks] ⚠️ No item data returned for ${itemId}`);
      }
    } catch (e) {
      console.error('Failed to fetch single project item:', e);
    }
  }, [updateSyncTime, dateSettings, selectedProject?.id]);

  const fetchProjectTasks = useCallback(async (projectId: string, token: string) => {
    setIsLoadingTasks(true);
    setFieldsProgress({ current: 0, total: 0, isFetching: true });
    console.log('[Tasks] Fetching items for project:', projectId, 'using account:', projectAccountId);
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

      const mappedTasks: Task[] = allItems.map(item => mapProjectItemToTask(item, dateSettings));

      const statusField = allFields.find((f: GitHubProjectV2Field) => f.name?.toLowerCase() === 'status');
      const statusOptions = (statusField?.options || []) as Array<{ name: string, color?: string }>;

      if (statusOptions.length > 0) {
        registerStatuses(statusOptions);
        setProjectStatusOptions(statusOptions.map(o => o.name));
      }

      setProjectFields(allFields);
      setTasks(cascadeAllTasks(mappedTasks));
      updateSyncTime();

      // Auto-sync missing values for Done tasks
      mappedTasks.forEach(task => {
        if (task.progress === 100 && task.itemId && selectedProject?.id) {
          const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
            if (fieldId) await updateProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, value, token);
          };
          if (!task.startDate && task.tempStartDate) {
            updateField(dateSettings.startDateFieldId || task.projectFieldIds?.startDate, { date: formatToGitHubDate(task.tempStartDate) });
          }
          if (!task.targetDate && task.tempTargetDate) {
            updateField(dateSettings.targetDateFieldId || task.projectFieldIds?.targetDate, { date: formatToGitHubDate(task.tempTargetDate) });
          }
          if (task.estimate === undefined && task.tempEstimate !== undefined) {
            updateField(dateSettings.estimateFieldId || task.projectFieldIds?.estimate, { number: task.tempEstimate });
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
  }, [updateSyncTime, t, projectAccountId, dateSettings, selectedProject?.id]);

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[], skipRefresh = false) => {
    const task = tasks.find(t => t.id === taskId || t.itemId === taskId);
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
  }, [tasks, githubToken, fetchSingleProjectItem]);

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

  const updateTaskDates = useCallback(async (task: Task, startDate?: string, targetDate?: string, estimate?: number, estimateUnit?: string, autoUpdateStartDate?: AutoUpdateStartDateMode, skipRefresh = false): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;
    
    // Optimistic Update
    const oldTasks = [...tasks];
    let nextTasks: Task[] = [];
    setTasks(prev => {
      const updated = prev.map(t => 
        (t.itemId === task.itemId || (t.contentId && t.contentId === task.contentId)) 
          ? { 
              ...t, 
              startDate: startDate !== undefined ? startDate : t.startDate,
              targetDate: (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined)
                ? calculateTargetDate(
                    startDate !== undefined ? startDate : t.startDate,
                    estimate !== undefined ? estimate : (t.estimate || 0),
                    estimateUnit !== undefined ? estimateUnit : (t.estimateUnit || 'days')
                  )
                : t.targetDate,
              estimate: estimate !== undefined ? estimate : t.estimate,
              estimateUnit: estimateUnit !== undefined ? estimateUnit : t.estimateUnit,
              autoUpdateStartDate: autoUpdateStartDate !== undefined ? autoUpdateStartDate : t.autoUpdateStartDate
            } 
          : t
      );
      nextTasks = cascadeTaskDates(updated, task.itemId!, new Set(), true);
      return nextTasks;
    });

    let anySuccess = false;
    try {
      const updateField = async (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
        if (!fieldId) return;
        const success = await updateProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, value, githubToken);
        if (success) anySuccess = true;
      };

      // Auto-calculate new target date if dependencies changed
      let finalTargetDate = targetDate;
      const effectiveStartDate = startDate !== undefined ? startDate : task.startDate;
      const effectiveEstimate = estimate !== undefined ? estimate : (task.estimate || 0);
      const effectiveUnit = estimateUnit !== undefined ? estimateUnit : (task.estimateUnit || 'days');
      
      if (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined) {
        const calculated = calculateTargetDate(effectiveStartDate, effectiveEstimate, effectiveUnit);
        if (calculated !== task.targetDate) {
          finalTargetDate = calculated;
        }
      }

      if (startDate) {
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
        // Persist cascaded changes
        const shiftedTasks = nextTasks.filter(t => {
          const old = oldTasks.find(ot => ot.id === t.id);
          // Skip the source task itself which we already updated
          if (t.id === task.id) return false;
          return old && (old.startDate !== t.startDate || old.targetDate !== t.targetDate);
        });

        for (const st of shiftedTasks) {
          const fIds = st.projectFieldIds;
          if (fIds?.startDate && st.startDate) {
            await updateProjectV2ItemField(selectedProject.id, st.itemId!, fIds.startDate, { date: formatToGitHubDate(st.startDate) }, githubToken);
          }
          if (fIds?.targetDate && st.targetDate) {
            await updateProjectV2ItemField(selectedProject.id, st.itemId!, fIds.targetDate, { date: formatToGitHubDate(st.targetDate) }, githubToken);
          }
        }

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
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, dateSettings, projectFields, setTasks]);

  const updateTaskSuccessors = useCallback(async (taskId: string, successorIds: string[], skipRefresh = false, decision?: 'auto' | 'locked' | 'ask'): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken || !dateSettings.successorFieldId) return false;
    
    // Identify the source task
    const task = tasks.find(t => t.itemId === taskId || t.id === taskId);
    if (!task || !task.itemId) return false;

    // Check for successors that might need asking
    let effectiveDecision = decision;
    if (!effectiveDecision) {
      const successorsToAsk = tasks.filter(t => 
        successorIds.includes(t.itemId!) && 
        (!t.autoUpdateStartDate || t.autoUpdateStartDate === 'ask')
      );
      if (successorsToAsk.length > 0) {
        effectiveDecision = await requestStartDateDecision(successorsToAsk);
      }
    }

    // Optimistic Update
    const oldTasks = [...tasks];
    let nextTasks: Task[] = [];
    setTasks(prev => {
      // Update successors for the source task
      let updated = prev.map(t => 
        (t.itemId === task.itemId) ? { ...t, successorIds } : t
      );
      
      // If user chose 'auto', update flags for the affected successors
      if (effectiveDecision === 'auto') {
        updated = updated.map(t => 
          (successorIds.includes(t.itemId!) && (!t.autoUpdateStartDate || t.autoUpdateStartDate === 'ask'))
            ? { ...t, autoUpdateStartDate: 'auto' as const }
            : t
        );
      }
      
      // Use real dates for persistence-bound operations
      nextTasks = cascadeTaskDates(updated, task.itemId!, new Set(), true);
      return nextTasks;
    });

    try {
      const textValue = successorIds.join(',');
      const success = await updateProjectV2ItemField(
        selectedProject.id, 
        task.itemId, 
        dateSettings.successorFieldId, 
        { text: textValue }, 
        githubToken
      );

      if (success) {
        // Persist cascaded date changes for successors
        // Find tasks that changed their dates during the cascade
        const shiftedTasks = nextTasks.filter(t => {
          const old = oldTasks.find(ot => ot.id === t.id);
          return old && (old.startDate !== t.startDate || old.targetDate !== t.targetDate);
        });

        for (const st of shiftedTasks) {
          const fieldIds = st.projectFieldIds;
          if (fieldIds?.startDate && st.startDate) {
            await updateProjectV2ItemField(selectedProject.id, st.itemId!, fieldIds.startDate, { date: formatToGitHubDate(st.startDate) }, githubToken);
          }
          if (fieldIds?.targetDate && st.targetDate) {
            await updateProjectV2ItemField(selectedProject.id, st.itemId!, fieldIds.targetDate, { date: formatToGitHubDate(st.targetDate) }, githubToken);
          }
        }

        if (!skipRefresh) fetchSingleProjectItem(task.itemId, githubToken);
      } else {
        setTasks(oldTasks);
      }
      return success;
    } catch (e) {
      console.error(e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, dateSettings.successorFieldId, tasks, fetchSingleProjectItem, requestStartDateDecision]);

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
  }): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) {
      console.error('No project selected or token available');
      return false;
    }

    const { title, body, status, startDate, targetDate, estimate, estimateUnit, autoUpdateStartDate, assigneeIds } = taskData;

    try {
      let repoNameWithOwner: string | null = null;
      if (tasks.length > 0 && tasks[0].repository) {
        repoNameWithOwner = tasks[0].repository;
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
        projectFieldIds: tasks.length > 0 ? tasks[0].projectFieldIds : undefined,
        statusOptions: tasks.length > 0 ? tasks[0].statusOptions : undefined,
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

      console.log(`[DashboardTasks] 🚀 Creation sequence complete, performing final fetch for: ${itemId}`);
      await fetchSingleProjectItem(itemId, githubToken);
      
      updateSyncTime();
      setIsCreateMode(false);

      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, tasks, fetchSingleProjectItem, updateSyncTime, updateTaskStatus, updateTaskDates, updateTaskAssignees, setIsCreateMode]);

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
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    fetchSearchUsers,
  };
}
