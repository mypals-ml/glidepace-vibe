import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { registerStatuses } from '../utils/statusColors';
import { mapProjectItemToTask } from '../lib/githubTaskMapper';
import {
  fetchSingleProjectItemGQL,
  fetchProjectTasksGQL,
  updateItemFieldGQL,
  updateIssueTitleGQL,
  updateIssueBodyGQL,
  addCommentGQL,
  updateCommentGQL,
  deleteCommentGQL,
  addAssigneesGQL,
  removeAssigneesGQL,
  searchAssignableUsersGQL,
  searchOrgMembersGQL,
  searchUsersGlobalGQL,
  getRepositoryIdGQL,
  createIssueGQL,
  addProjectItemGQL,
  createDraftItemGQL,
} from '../lib/githubOperations';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, GitHubProjectV2, GitHubProjectItem, GitHubProjectV2Field, GitHubAssignee } from '../types';

export interface UseDashboardTasksReturn {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  isLoadingTasks: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectStatusOptions: string[];
  setProjectStatusOptions: React.Dispatch<React.SetStateAction<string[]>>;
  filteredTasks: Task[];
  availableUsers: User[];
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<void>;
  handleCreateTask: (taskData: {
    title: string;
    body?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    assigneeIds?: string[];
  }) => Promise<boolean>;
  updateTaskStatus: (task: Task, status: TaskStatus) => Promise<boolean>;
  updateTaskTitle: (task: Task, title: string) => Promise<boolean>;
  updateTaskDescription: (task: Task, description: string) => Promise<boolean>;
  updateTaskDates: (task: Task, startDate?: string, endDate?: string) => Promise<boolean>;
  updateTaskAssignees: (taskId: string, userIds: string[]) => Promise<boolean>;
  updateTaskComment: (task: Task, commentId: string, body: string) => Promise<boolean>;
  deleteTaskComment: (task: Task, commentId: string) => Promise<boolean>;
  addTaskComment: (task: Task, body: string) => Promise<boolean>;
  fetchSearchUsers: (query: string, repository?: string) => Promise<User[]>;
}

export function useDashboardTasks(deps: {
  githubToken: string;
  githubAccounts: GithubAccount[];
  activeAccountId: string;
  selectedProject: { id: string; title: string; public: boolean } | null;
  projectsData: ProjectOwnerInfo[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  updateSyncTime: () => void;
  setApiError: (error: string | null) => void;
  setIsCreateMode: (val: boolean) => void;
}): UseDashboardTasksReturn {
  const { t } = useTranslation();
  const {
    githubToken,
    githubAccounts,
    activeAccountId,
    selectedProject,
    projectsData,
    tasks,
    setTasks,
    updateSyncTime,
    setApiError,
    setIsCreateMode,
  } = deps;

  // ---- Task-specific state ----
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);

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

  const filteredTasks = (tasks || []).filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = task.title.toLowerCase().includes(query);
    const matchesAssignee = (task.assignees || []).some(
      a => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
    );
    return matchesTitle || matchesAssignee;
  });

  // ---- API: fetch tasks ----

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    try {
      const json = await fetchSingleProjectItemGQL(itemId, token);
      const itemData = json.data?.node as GitHubProjectItem;

      if (itemData) {
        const updatedTask = mapProjectItemToTask(itemData);
        setTasks(prevTasks => prevTasks.map(t =>
          (t.itemId === updatedTask.itemId || t.contentId === updatedTask.contentId) ? updatedTask : t
        ));
        updateSyncTime();
      }
    } catch (e) {
      console.error('Failed to fetch single project item:', e);
    }
  }, [updateSyncTime]);

  const fetchProjectTasks = useCallback(async (projectId: string, token: string) => {
    setIsLoadingTasks(true);
    try {
      const json = await fetchProjectTasksGQL(projectId, token);

      if (json.errors) {
        console.error('GraphQL Errors fetching items:', json.errors);
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
        registerStatuses(statusOptions as Array<{ name: string, color?: string }>);
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
  }, [updateSyncTime, setApiError, t]);

  // ---- Task mutations ----

  const updateTaskStatus = useCallback(async (task: Task, status: TaskStatus): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !task.projectFieldIds?.status || !task.statusOptions || !githubToken) return false;
    try {
      const optionId = task.statusOptions[status];
      if (!optionId) return false;
      const res = await updateItemFieldGQL(selectedProject.id, task.itemId, task.projectFieldIds.status, { singleSelectOptionId: optionId }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      fetchSingleProjectItem(task.itemId, githubToken);
      return true;
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
        const res = await updateItemFieldGQL(selectedProject.id, task.itemId!, fieldId, { date: new Date(dateVal).toISOString() }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        anySuccess = true;
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

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const res = await updateIssueTitleGQL(task.contentId, title, githubToken);
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
      const res = await updateIssueBodyGQL(task.contentId, description, githubToken);
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
      const res = await updateCommentGQL(commentId, body, githubToken);
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
      const res = await deleteCommentGQL(commentId, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const addTaskComment = useCallback(async (task: Task, body: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const res = await addCommentGQL(task.contentId, body, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[]) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.contentId || !githubToken) return false;

    const currentIds = task.assignees.map(a => a.id).filter(id => id !== 'unassigned');
    const addedIds = userIds.filter(id => !currentIds.includes(id));
    const removedIds = currentIds.filter(id => !userIds.includes(id));

    if (addedIds.length === 0 && removedIds.length === 0) return true;

    try {
      let latestAssigneeNodes: GitHubAssignee[] | undefined;

      if (addedIds.length > 0) {
        const res = await addAssigneesGQL(task.contentId, addedIds, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.addAssigneesToAssignable?.assignable?.assignees?.nodes;
      }

      if (removedIds.length > 0) {
        const res = await removeAssigneesGQL(task.contentId, removedIds, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.removeAssigneesFromAssignable?.assignable?.assignees?.nodes;
      }

      if (latestAssigneeNodes) {
        const updatedAssignees: User[] = latestAssigneeNodes.length > 0
          ? latestAssigneeNodes.map((a: GitHubAssignee, idx: number) => ({
            id: a.id || a.login || 'unknown',
            name: a.name || a.login || 'Unknown',
            avatarUrl: a.avatarUrl,
            initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
            avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
          }))
          : [];

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

        const repoResult = await getRepositoryIdGQL(owner, repo, githubToken);
        const repositoryId = repoResult.data?.repository?.id;

        if (repositoryId) {
          const issueResult = await createIssueGQL(repositoryId, title, body, githubToken);
          contentId = issueResult.data?.createIssue?.issue?.id;

          if (contentId) {
            const addResult = await addProjectItemGQL(selectedProject.id, contentId, githubToken);
            itemId = addResult.data?.addProjectV2ItemById?.item?.id;
          }
        }
      }

      if (!itemId) {
        console.log('No repository found or issue creation failed. Creating Draft Issue instead.');
        const draftResult = await createDraftItemGQL(selectedProject.id, title, body, githubToken);
        itemId = draftResult.data?.addProjectV2DraftIssue?.projectItem?.id;
      }

      if (!itemId) {
        console.error('Failed to create task (neither Issue nor Draft)');
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

  const fetchSearchUsers = useCallback(async (searchTerm: string, repository?: string): Promise<User[]> => {
    if (!githubToken) return [];

    try {
      const resultsMap = new Map<string, User>();

      const currentAccount = githubAccounts.find(a => a.id === activeAccountId);
      if (currentAccount) {
        const currentUser: User = {
          id: currentAccount.id,
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
          const assignableJson = await searchAssignableUsersGQL(owner, name, searchTerm || undefined, githubToken);
          const assignableNodes = (assignableJson.data?.repository?.assignableUsers?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          assignableNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) ||
                                (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));

              if (!isDuplicate) {
                resultsMap.set(n.id, {
                  id: n.id,
                  login: n.login,
                  name: n.name || n.login || 'Unknown User',
                  avatarUrl: n.avatarUrl || '',
                  initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                  avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
                });
              }
            }
          });
        }
      }

      const currentOwner = projectsData.find(o => o.projects.some(p => p.id === selectedProject?.id));

      if (!searchTerm && !repository && currentOwner) {
        if (currentOwner.isOrg) {
          const orgJson = await searchOrgMembersGQL(currentOwner.login, githubToken);
          const orgNodes = (orgJson.data?.organization?.membersWithRole?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          orgNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) ||
                                (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));

              if (!isDuplicate) {
                resultsMap.set(n.id, {
                  id: n.id,
                  login: n.login,
                  name: n.name || n.login || 'Unknown User',
                  avatarUrl: n.avatarUrl || '',
                  initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                  avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
                });
              }
            }
          });
        }
      }

      if (searchTerm && searchTerm.length >= 2) {
        let shouldGlobalSearch = false;
        let searchQuery = searchTerm;

        if (currentOwner?.isOrg) {
          shouldGlobalSearch = true;
          searchQuery = `org:${currentOwner.login} ${searchTerm}`;
        } else if (currentOwner && selectedProject?.public) {
          shouldGlobalSearch = true;
          searchQuery = `${searchTerm}`;
        }

        if (shouldGlobalSearch) {
          const globalJson = await searchUsersGlobalGQL(searchQuery, githubToken);
          const globalNodes = (globalJson.data?.search?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          globalNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) ||
                                (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));

              if (!isDuplicate) {
                const displayName = n.name || n.login || 'Unknown User';
                resultsMap.set(n.id, {
                  id: n.id,
                  login: n.login,
                  name: displayName,
                  avatarUrl: n.avatarUrl || '',
                  initials: displayName.substring(0, 2).toUpperCase(),
                  avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
                });
              }
            }
          });
        }
      }

      return Array.from(resultsMap.values());
    } catch (e) {
      console.error('Search users failed:', e);
      return [];
    }
  }, [githubToken, projectsData, selectedProject, activeAccountId, githubAccounts, t]);

  return {
    tasks,
    setTasks,
    isLoadingTasks,
    searchQuery,
    setSearchQuery,
    projectStatusOptions,
    setProjectStatusOptions,
    filteredTasks,
    availableUsers,
    fetchProjectTasks,
    fetchSingleProjectItem,
    handleCreateTask,
    updateTaskStatus,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskDates,
    updateTaskAssignees,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    fetchSearchUsers,
  };
}
