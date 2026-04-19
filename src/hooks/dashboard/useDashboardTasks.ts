import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus, User, GithubAccount, GitHubProjectV2, GitHubProjectV2Field, GitHubProjectItem, GitHubAssignee, ProjectOwnerInfo } from '../../types';
import { mapProjectItemToTask } from '../../lib/githubTaskMapper';
import { registerStatuses } from '../../utils/statusColors';
import * as api from '../../services/githubApiService';

interface UseDashboardTasksProps {
  githubToken: string;
  selectedProject: { id: string; title: string; public: boolean } | null;
  updateSyncTime: () => void;
  githubAccounts: GithubAccount[];
  activeAccountId: string;
  setIsCreateMode: (mode: boolean) => void;
  projectsData: ProjectOwnerInfo[];
}

export function useDashboardTasks({
  githubToken,
  selectedProject,
  updateSyncTime,
  githubAccounts,
  activeAccountId,
  setIsCreateMode,
  projectsData,
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
        a => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
      );
      return matchesTitle || matchesAssignee;
    });
  }, [tasks, searchQuery]);

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    try {
      const json = await api.fetchSingleProjectItemApi(itemId, token);
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
      const json = await api.fetchProjectTasksApi(projectId, token);

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
  }, [updateSyncTime, t]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const res = await api.updateIssueTitleApi(task.contentId, title, githubToken);
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
      const res = await api.updateIssueBodyApi(task.contentId, description, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  const updateTaskStatus = useCallback(async (task: Task, status: TaskStatus): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !task.projectFieldIds?.status || !task.statusOptions || !githubToken) return false;
    try {
      const optionId = task.statusOptions[status];
      if (!optionId) return false;
      const value = { singleSelectOptionId: optionId };
      const res = await api.updateProjectItemFieldApi(selectedProject.id, task.itemId, task.projectFieldIds.status, value, githubToken);
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
      const itemId = task.itemId!;
      const updateField = async (fieldId: string | undefined, dateVal: string) => {
        if (!fieldId) return;
        const value = { date: new Date(dateVal).toISOString() };
        const res = await api.updateProjectItemFieldApi(selectedProject!.id, itemId, fieldId, value, githubToken);
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
  }, [selectedProject, githubToken, fetchSingleProjectItem]);

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
        const res = await api.addAssigneesApi(task.contentId, addedIds, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.addAssigneesToAssignable?.assignable?.assignees?.nodes;
      }

      if (removedIds.length > 0) {
        const res = await api.removeAssigneesApi(task.contentId, removedIds, githubToken);
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

  const handleCreateTask = useCallback(async ({ title, body, status, startDate, endDate, assigneeIds }: {
    title: string;
    body?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    assigneeIds?: string[];
  }): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) return false;

    try {
      let repoNameWithOwner: string | null = null;
      if (tasks.length > 0 && tasks[0].repository) {
        repoNameWithOwner = tasks[0].repository;
      }

      let itemId: string | null = null;
      let contentId: string | null = null;

      if (repoNameWithOwner) {
        const [owner, repo] = repoNameWithOwner.split('/');
        const repoResult = await api.getRepositoryIdApi(owner, repo, githubToken);
        const repositoryId = repoResult.data?.repository?.id;

        if (repositoryId) {
          const issueResult = await api.createIssueApi(repositoryId, title, body, githubToken);
          contentId = issueResult.data?.createIssue?.issue?.id;

          if (contentId) {
            const addResult = await api.addProjectItemApi(selectedProject.id, contentId, githubToken);
            itemId = addResult.data?.addProjectV2ItemById?.item?.id;
          }
        }
      }

      if (!itemId) {
        const draftResult = await api.addDraftItemApi(selectedProject.id, title, body, githubToken);
        itemId = draftResult.data?.addProjectV2DraftIssue?.projectItem?.id;
      }

      if (!itemId) return false;

      const tempTask: Task = {
        id: itemId,
        itemId: itemId,
        contentId: contentId || undefined,
        title,
        status: status || 'Todo',
        startDate: startDate || '',
        endDate: endDate || '',
        fullStartDate: startDate,
        fullEndDate: endDate,
        assignees: [],
        progress: 0,
        projectFieldIds: tasks.length > 0 ? tasks[0].projectFieldIds : undefined,
        statusOptions: tasks.length > 0 ? tasks[0].statusOptions : undefined,
      };

      if (status && tempTask.statusOptions) await updateTaskStatus(tempTask, status);
      if (startDate || endDate) await updateTaskDates(tempTask, startDate, endDate);
      if (assigneeIds && assigneeIds.length > 0 && contentId) await updateTaskAssignees(itemId, assigneeIds);

      await fetchProjectTasks(selectedProject.id, githubToken);
      updateSyncTime();
      setIsCreateMode(false);
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, tasks, fetchProjectTasks, updateSyncTime, updateTaskStatus, updateTaskDates, updateTaskAssignees, setIsCreateMode]);

  const updateTaskComment = useCallback(async (task: Task, commentId: string, body: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const res = await api.updateCommentApi(commentId, body, githubToken);
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
      const res = await api.deleteCommentApi(commentId, githubToken);
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
      const res = await api.addCommentApi(task.contentId, body, githubToken);
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
          const assignableJson = await api.fetchAssignableUsersApi(owner, name, searchTerm || undefined, githubToken);
          const assignableNodes = (assignableJson.data?.repository?.assignableUsers?.nodes || []) as GitHubAssignee[];
          
          assignableNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) || (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));
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
          const orgJson = await api.fetchOrgMembersApi(currentOwner.login, githubToken);
          const orgNodes = (orgJson.data?.organization?.membersWithRole?.nodes || []) as GitHubAssignee[];
          
          orgNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) || (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));
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
        let query = searchTerm;

        if (currentOwner?.isOrg) {
          shouldGlobalSearch = true;
          query = `org:${currentOwner.login} ${searchTerm}`;
        } else if (currentOwner && selectedProject?.public) {
          shouldGlobalSearch = true;
          query = `${searchTerm}`;
        }

        if (shouldGlobalSearch) {
          const globalJson = await api.searchUsersApi(query, githubToken);
          const globalNodes = (globalJson.data?.search?.nodes || []) as GitHubAssignee[];
          
          globalNodes.forEach((n, idx) => {
            if (n && n.id) {
              const isDuplicate = resultsMap.has(n.id) || (n.login && Array.from(resultsMap.values()).some(u => u.login === n.login));
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
    setIsLoadingTasks,
    searchQuery,
    setSearchQuery,
    projectStatusOptions,
    setProjectStatusOptions,
    apiError,
    setApiError,
    availableUsers,
    filteredTasks,
    fetchSingleProjectItem,
    fetchProjectTasks,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskStatus,
    updateTaskDates,
    updateTaskAssignees,
    handleCreateTask,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    fetchSearchUsers,
  };
}
