import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, getRepositoryId, createGitHubIssue, addProjectV2Item, addProjectV2DraftIssue, updateProjectV2ItemField } from '../lib/githubService';
import { mapProjectItemToTask } from '../lib/githubTaskMapper';
import { registerStatuses } from '../utils/statusColors';
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
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, GitHubProjectV2, GitHubProjectItem, GitHubProjectV2Field, GitHubAssignee } from '../types';

interface UseDashboardTasksProps {
  githubToken: string;
  selectedProject: { id: string; title: string; public: boolean; accountId?: string } | null;
  projectsData: ProjectOwnerInfo[];
  projectAccountId: string;
  githubAccounts: GithubAccount[];
  updateSyncTime: () => void;
  setIsCreateMode: (val: boolean) => void;
}

export function useDashboardTasks({
  githubToken,
  selectedProject,
  projectsData,
  projectAccountId,
  githubAccounts,
  updateSyncTime,
  setIsCreateMode,
}: UseDashboardTasksProps) {
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
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
      const matchesAssignee = (task.assignees || []).some(
        a => a.name.toLowerCase().includes(query) || (a.login && a.login.toLowerCase().includes(query))
      );
      return matchesTitle || matchesAssignee;
    });
  }, [tasks, searchQuery]);

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    console.log(`[DashboardTasks] 📡 Fetching single item: ${itemId}`);
    try {
      const json = await fetchGitHubGraphQL(GET_SINGLE_ITEM_QUERY, { itemId }, token);
      console.log(`[DashboardTasks] 📥 GraphQL Response for ${itemId}:`, json);
      const itemData = json.data?.node as GitHubProjectItem;

      if (itemData) {
        const updatedTask = mapProjectItemToTask(itemData);
        console.log(`[DashboardTasks] ✅ Mapped Task for ${itemId}:`, {
          title: updatedTask.title,
          status: updatedTask.status,
          isDraft: updatedTask.isDraft,
          contentId: updatedTask.contentId
        });
        setTasks(prevTasks => {
          const match = prevTasks.find(t => t.itemId === updatedTask.itemId || t.contentId === updatedTask.contentId);
          if (!match) {
            console.warn(`[DashboardTasks] ⚠️ Received task update for ${itemId} but couldn't find it in local state.`, {
              receivedItemId: updatedTask.itemId,
              receivedContentId: updatedTask.contentId,
              existingIds: prevTasks.map(t => ({ itemId: t.itemId, contentId: t.contentId }))
            });
          }
          return prevTasks.map(t =>
            (t.itemId === updatedTask.itemId || t.contentId === updatedTask.contentId) ? updatedTask : t
          );
        });
        updateSyncTime();
      } else {
        console.warn(`[DashboardTasks] ⚠️ No item data returned for ${itemId}`);
      }
    } catch (e) {
      console.error('Failed to fetch single project item:', e);
    }
  }, [updateSyncTime]);

  const fetchProjectTasks = useCallback(async (projectId: string, token: string) => {
    setIsLoadingTasks(true);
    console.log('[Tasks] Fetching items for project:', projectId, 'using account:', projectAccountId);
    try {
      const json = await fetchGitHubGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }, token);

      if (json.errors) {
        console.error('GraphQL Errors fetching items:', JSON.stringify(json.errors, null, 2));
        setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
        setTasks([]);
        return;
      }

      setApiError(null);
      const projectNode = json.data?.node as GitHubProjectV2;
      const items = projectNode?.items?.nodes || [];
      const fields = projectNode?.fields?.nodes || [];

      const mappedTasks: Task[] = items.map(mapProjectItemToTask);

      const statusField = fields.find((f: GitHubProjectV2Field) => f.name?.toLowerCase() === 'status');
      const statusOptions = (statusField?.options || []) as Array<{ name: string, color?: string }>;

      if (statusOptions.length > 0) {
        registerStatuses(statusOptions);
        setProjectStatusOptions(statusOptions.map(o => o.name));
      }

      setTasks(mappedTasks);
      updateSyncTime();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch project tasks:', error);
      setApiError(error.message || t('dashboard.unknownError'));
    } finally {
      setIsLoadingTasks(false);
    }
  }, [updateSyncTime, t, projectAccountId]);

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[]) => {
    const task = tasks.find(t => t.id === taskId || t.itemId === taskId);
    if (!task || !task.contentId || !githubToken) return false;

    if (task.isDraft) {
      try {
        const res = await fetchGitHubGraphQL(UPDATE_DRAFT_ASSIGNEES_MUTATION, { id: task.contentId, assigneeIds: userIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        if (task.itemId) await fetchSingleProjectItem(task.itemId, githubToken);
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

      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      return true;
    } catch (e) {
      console.error('Update task assignees failed:', e);
      return false;
    }
  }, [tasks, githubToken, fetchSingleProjectItem]);

  const updateTaskStatus = useCallback(async (task: Task, status: TaskStatus): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !task.projectFieldIds?.status || !task.statusOptions || !githubToken) return false;
    try {
      const optionId = task.statusOptions[status];
      if (!optionId) return false;
      const success = await updateProjectV2ItemField(selectedProject.id, task.itemId, task.projectFieldIds.status, { singleSelectOptionId: optionId }, githubToken);
      if (success) fetchSingleProjectItem(task.itemId, githubToken);
      return success;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem]);

  const updateTaskDates = useCallback(async (task: Task, startDate?: string, endDate?: string): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;
    let anySuccess = false;
    try {
      const updateField = async (fieldId: string | undefined, dateVal: string) => {
        if (!fieldId) return;
        const success = await updateProjectV2ItemField(selectedProject.id, task.itemId!, fieldId, { date: new Date(dateVal).toISOString() }, githubToken);
        if (success) anySuccess = true;
      };

      if (startDate) await updateField(task.projectFieldIds?.startDate, startDate);
      if (endDate) await updateField(task.projectFieldIds?.endDate, endDate);

      if (anySuccess) fetchSingleProjectItem(task.itemId, githubToken);
      return anySuccess;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem]);

  const handleCreateTask = useCallback(async (taskData: {
    title: string;
    body?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    assigneeIds?: string[];
  }): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) {
      console.error('No project selected or token available');
      return false;
    }

    const { title, body, status, startDate, endDate, assigneeIds } = taskData;

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
        itemId: itemId,
        contentId: contentId || undefined,
        title,
        status: 'Todo',
        startDate: '',
        endDate: '',
        assignees: [],
        progress: 0,
        projectFieldIds: tasks.length > 0 ? tasks[0].projectFieldIds : undefined,
        statusOptions: tasks.length > 0 ? tasks[0].statusOptions : undefined,
      };

      if (status && tempTask.statusOptions) {
        await updateTaskStatus(tempTask, status);
      }
      if (startDate || endDate) {
        await updateTaskDates(tempTask, startDate, endDate);
      }
      if (assigneeIds && assigneeIds.length > 0 && contentId) {
        await updateTaskAssignees(itemId, assigneeIds);
      }

      await fetchProjectTasks(selectedProject.id, githubToken);
      updateSyncTime();
      setIsCreateMode(false);

      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, tasks, fetchProjectTasks, updateSyncTime, updateTaskStatus, updateTaskDates, updateTaskAssignees, setIsCreateMode]);

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
    apiError,
    availableUsers,
    filteredTasks,
    fetchProjectTasks,
    fetchSingleProjectItem,
    updateTaskAssignees,
    updateTaskStatus,
    updateTaskDates,
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    fetchSearchUsers,
  };
}
