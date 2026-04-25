import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import {
  addAssignees,
  addIssueComment,
  addProjectItemByContentId,
  createDraftProjectItem,
  createIssue,
  deleteIssueComment,
  fetchOrgMembers,
  fetchProjectItem,
  fetchProjectWithItems,
  fetchRepositoryId,
  removeAssignees,
  searchAssignableUsers,
  searchGlobalUsers,
  setProjectItemDate,
  setProjectItemStatus,
  updateIssueBody,
  updateIssueCommentBody,
  updateIssueTitle,
} from '../lib/githubApi';
import { mapProjectItemToTask } from '../lib/githubTaskMapper';
import { registerStatuses } from '../utils/statusColors';
import type {
  GitHubAssignee,
  GitHubProjectV2Field,
  GithubAccount,
  ProjectOwnerInfo,
  Task,
  TaskStatus,
  User,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const USER_AVATAR_PALETTE = [
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-purple-100 text-purple-700',
];

const ASSIGNEE_AVATAR_PALETTE = [
  'bg-amber-200 text-amber-700',
  'bg-indigo-200 text-indigo-700',
  'bg-emerald-200 text-emerald-700',
  'bg-rose-200 text-rose-700',
];

export interface UseDashboardTasksArgs {
  githubToken: string;
  selectedProject: { id: string; title: string; public: boolean } | null;
  activeAccountId: string;
  githubAccounts: GithubAccount[];
  projectsData: ProjectOwnerInfo[];
  onApiError: (msg: string | null) => void;
}

export function useDashboardTasks({
  githubToken,
  selectedProject,
  activeAccountId,
  githubAccounts,
  projectsData,
  onApiError,
}: UseDashboardTasksArgs) {
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);

  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => {
    const saved = localStorage.getItem('last_synced_time');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(v => v + 1), 10000);
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
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return (tasks || []).filter(task => {
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesAssignee = (task.assignees || []).some(
        a => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query),
      );
      return matchesTitle || matchesAssignee;
    });
  }, [tasks, searchQuery]);

  // ---- Fetching ----

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    try {
      const itemData = await fetchProjectItem(itemId, token);
      if (itemData) {
        const updatedTask = mapProjectItemToTask(itemData);
        setTasks(prev => prev.map(task =>
          (task.itemId === updatedTask.itemId || task.contentId === updatedTask.contentId) ? updatedTask : task,
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
      const json = await fetchProjectWithItems(projectId, token);

      if (json.errors) {
        console.error('GraphQL Errors fetching items:', json.errors);
        onApiError(json.errors.map(e => e.message).join(', '));
        setTasks([]); // Clear tasks on error to avoid showing stale data from previous project
        return;
      }

      onApiError(null);
      const projectNode = json.data?.node;
      const items = projectNode?.items?.nodes || [];
      const fields = projectNode?.fields?.nodes || [];

      const mappedTasks: Task[] = items.map(mapProjectItemToTask);

      const statusField = fields.find((f: GitHubProjectV2Field) => f.name?.toLowerCase() === 'status');
      const statusOptions = (statusField?.options || []) as Array<{ name: string; color?: string }>;

      if (statusOptions.length > 0) {
        registerStatuses(statusOptions);
        setProjectStatusOptions(statusOptions.map(o => o.name));
      }

      setTasks(mappedTasks);
      updateSyncTime();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch project tasks:', error);
      onApiError(error.message || t('dashboard.unknownError'));
    } finally {
      setIsLoadingTasks(false);
    }
  }, [updateSyncTime, t, onApiError]);

  // ---- Real-time sync via Supabase ----

  // Keep a ref to the latest tasks so the channel handler can look up items
  // without re-subscribing on every tasks update.
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Stable dep: serialized, sorted repo list. Only changes when the set of
  // repos actually changes — not on every task update.
  const repoChannelKey = useMemo(() => {
    const names = Array.from(new Set(tasks.map(task => task.repository).filter(Boolean) as string[]));
    names.sort();
    return names.join('|');
  }, [tasks]);

  useEffect(() => {
    if (!selectedProject?.id || !supabase) return;

    const projectChannelLabel = `project-${selectedProject.id}`;
    const repoNames = repoChannelKey ? repoChannelKey.split('|') : [];
    const repoChannelLabels = repoNames.map(name => `repo-${name.replace(/\//g, '-')}`);
    const allChannels = [projectChannelLabel, ...repoChannelLabels];

    const activeChannels = allChannels.map(label => {
      const channel = supabase.channel(label);
      channel
        .on('broadcast', { event: 'sync' }, () => {
          if (githubToken && selectedProject.id) {
            fetchProjectTasks(selectedProject.id, githubToken);
          }
        })
        .on('broadcast', { event: 'refresh_task' }, (payload) => {
          const { itemId, contentId } = payload.payload || {};
          console.log(`[DashboardSync] Targeted Refresh RECEIVED on ${label}:`, { itemId, contentId });

          if (githubToken && itemId) {
            fetchSingleProjectItem(itemId, githubToken);
          } else if (githubToken && contentId) {
            const task = tasksRef.current.find(t => t.contentId === contentId);
            if (task && task.itemId) {
              fetchSingleProjectItem(task.itemId, githubToken);
            } else if (selectedProject?.id) {
              fetchProjectTasks(selectedProject.id, githubToken);
            }
          } else if (githubToken && selectedProject?.id) {
            fetchProjectTasks(selectedProject.id, githubToken);
          }
        })
        .subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [selectedProject?.id, githubToken, fetchProjectTasks, fetchSingleProjectItem, repoChannelKey]);

  // ---- User search ----

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

      const addUserNode = (n: { id?: string; login?: string; name?: string; avatarUrl?: string }, idx: number) => {
        if (!n || !n.id) return;
        const isDuplicate = resultsMap.has(n.id) ||
          (n.login ? Array.from(resultsMap.values()).some(u => u.login === n.login) : false);
        if (isDuplicate) return;

        const displayName = n.name || n.login || 'Unknown User';
        resultsMap.set(n.id, {
          id: n.id,
          login: n.login,
          name: displayName,
          avatarUrl: n.avatarUrl || '',
          initials: displayName.substring(0, 2).toUpperCase(),
          avatarColor: USER_AVATAR_PALETTE[(resultsMap.size + idx) % USER_AVATAR_PALETTE.length],
        });
      };

      // 1. Repository-assignable users (authoritative)
      if (repository) {
        const [owner, name] = repository.split('/');
        if (owner && name) {
          const nodes = await searchAssignableUsers(owner, name, searchTerm, githubToken);
          nodes.forEach(addUserNode);
        }
      }

      const currentOwner = projectsData.find(o => o.projects.some(p => p.id === selectedProject?.id));

      // 2. Cold start: org members when no search term and no repo
      if (!searchTerm && !repository && currentOwner?.isOrg) {
        const nodes = await fetchOrgMembers(currentOwner.login, githubToken);
        nodes.forEach(addUserNode);
      }

      // 3. Global user search fallback for orgs / public projects
      if (searchTerm && searchTerm.length >= 2) {
        let shouldGlobalSearch = false;
        let globalQuery = searchTerm;

        if (currentOwner?.isOrg) {
          shouldGlobalSearch = true;
          globalQuery = `org:${currentOwner.login} ${searchTerm}`;
        } else if (currentOwner && selectedProject?.public) {
          shouldGlobalSearch = true;
          globalQuery = `${searchTerm}`;
        }

        if (shouldGlobalSearch) {
          const nodes = await searchGlobalUsers(globalQuery, githubToken);
          nodes.forEach(addUserNode);
        }
      }

      return Array.from(resultsMap.values());
    } catch (e) {
      console.error('Search users failed:', e);
      return [];
    }
  }, [githubToken, projectsData, selectedProject, activeAccountId, githubAccounts, t]);

  // ---- Mutations ----

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
        latestAssigneeNodes = await addAssignees(task.contentId, addedIds, githubToken);
      }
      if (removedIds.length > 0) {
        latestAssigneeNodes = await removeAssignees(task.contentId, removedIds, githubToken);
      }

      if (latestAssigneeNodes) {
        const updatedAssignees: User[] = latestAssigneeNodes.length > 0
          ? latestAssigneeNodes.map((a, idx) => ({
            id: a.id || a.login || 'unknown',
            name: a.name || a.login || 'Unknown',
            avatarUrl: a.avatarUrl,
            initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
            avatarColor: ASSIGNEE_AVATAR_PALETTE[idx % ASSIGNEE_AVATAR_PALETTE.length],
          }))
          : [];

        setTasks(prev => prev.map(t =>
          (t.id === taskId || t.itemId === taskId) ? { ...t, assignees: updatedAssignees } : t,
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
      await setProjectItemStatus({
        projectId: selectedProject.id,
        itemId: task.itemId,
        fieldId: task.projectFieldIds.status,
        optionId,
        token: githubToken,
      });
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
        await setProjectItemDate({
          projectId: selectedProject.id,
          itemId: task.itemId!,
          fieldId,
          date: dateVal,
          token: githubToken,
        });
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
        const repositoryId = await fetchRepositoryId(owner, repo, githubToken);

        if (repositoryId) {
          contentId = (await createIssue(repositoryId, title, body, githubToken)) ?? null;
          if (contentId) {
            itemId = (await addProjectItemByContentId(selectedProject.id, contentId, githubToken)) ?? null;
          }
        }
      }

      if (!itemId) {
        console.log('No repository found or issue creation failed. Creating Draft Issue instead.');
        itemId = (await createDraftProjectItem(selectedProject.id, title, body, githubToken)) ?? null;
      }

      if (!itemId) {
        console.error('Failed to create task (neither Issue nor Draft)');
        return false;
      }

      const tempTask: Task = {
        id: itemId,
        itemId,
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

      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, tasks, fetchProjectTasks, updateSyncTime, updateTaskStatus, updateTaskDates, updateTaskAssignees]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      await updateIssueTitle(task.contentId, title, githubToken);
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
      await updateIssueBody(task.contentId, description, githubToken);
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
      await updateIssueCommentBody(commentId, body, githubToken);
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
      await deleteIssueComment(commentId, githubToken);
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
      await addIssueComment(task.contentId, body, githubToken);
      if (task.itemId) fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem]);

  return {
    tasks,
    setTasks,
    isLoadingTasks,
    projectStatusOptions,
    setProjectStatusOptions,
    searchQuery,
    setSearchQuery,
    filteredTasks,
    availableUsers,
    lastSyncedTime,
    getSyncedTimeText,
    updateSyncTime,
    fetchProjectTasks,
    fetchSingleProjectItem,
    fetchSearchUsers,
    handleCreateTask,
    updateTaskStatus,
    updateTaskDates,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    updateTaskAssignees,
  };
}
