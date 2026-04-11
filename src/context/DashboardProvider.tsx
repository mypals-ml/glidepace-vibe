import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { DUMMY_TASKS } from '../lib/dummyData';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS, MOCK_PROJECTS } from '../lib/mockData';
import { fetchGitHubGraphQL } from '../lib/githubService';
import { DUMMY_PROJECT_ID, MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod, GitHubProjectV2, GitHubProjectItem, GitHubProjectV2Field } from '../types';
import { registerStatuses } from '../utils/statusColors';
import { mapProjectItemToTask, PROJECT_ITEM_FRAGMENT } from '../lib/githubTaskMapper';
import { DashboardContext } from './DashboardContext';
import type { DashboardContextValue } from './DashboardContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ========================================
// Provider
// ========================================

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  // ---- Auth state ----
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>(() => {
    if (USE_MOCK_DATA) return MOCK_ACCOUNTS;
    try {
      return JSON.parse(localStorage.getItem('github_accounts') || '[]');
    } catch {
      return [];
    }
  });
  const [activeAccountId, setActiveAccountIdState] = useState<string>(
    () => USE_MOCK_DATA ? MOCK_ACCOUNTS[0].id : (localStorage.getItem('active_github_account_id') || '')
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  const githubToken = githubAccounts.find(a => a.id === activeAccountId)?.token || '';

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    localStorage.setItem('active_github_account_id', id);
  }, []);

  // ---- Project state ----
  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>(USE_MOCK_DATA ? MOCK_ACCOUNTS[0].login : '');
  const [selectedProject, setSelectedProject] = useState<{ id: string; title: string; public: boolean } | null>(() => {
    try {
      const saved = localStorage.getItem('selected_project');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [hasProject, setHasProject] = useState(() => {
    return !!localStorage.getItem('selected_project_type') || !!localStorage.getItem('selected_project');
  });
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('project_history') || '[]');
    } catch {
      return [];
    }
  });
  const [sortMethod, setSortMethod] = useState<SortMethod>('recent');
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Modal state ----
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // ---- UI state ----
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ---- Task state ----
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusOptions, setProjectStatusOptions] = useState<string[]>([]);
  const availableUsers = useMemo<User[]>(() => {
    const userMap = new Map<string, User>();
    tasks.forEach(task => {
      task.assignees.forEach(user => {
        if (user.id !== 'unassigned') {
          userMap.set(user.id, user);
        }
      });
    });
    return Array.from(userMap.values());
  }, [tasks]);

  // ---- Sync state ----
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

  // ---- Helpers ----

  const groupHistoryByDate = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - 7 * 86400000;

    const groups: Record<string, ProjectHistoryItem[]> = {
      today: [],
      yesterday: [],
      last7Days: [],
      earlier: [],
    };

    projectHistory.forEach(item => {
      if (item.lastOpened >= today) groups.today.push(item);
      else if (item.lastOpened >= yesterday) groups.yesterday.push(item);
      else if (item.lastOpened >= last7Days) groups.last7Days.push(item);
      else groups.earlier.push(item);
    });

    return groups;
  }, [projectHistory]);

  const sortProjectsFn = useCallback((projects: GitHubProject[]): GitHubProject[] => {
    const sorted = [...projects];
    switch (sortMethod) {
      case 'oldest':
        return sorted.reverse();
      case 'nameAZ':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'nameZA':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'recent':
      default:
        return sorted;
    }
  }, [sortMethod]);

  const filteredTasks = (tasks || []).filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = task.title.toLowerCase().includes(query);
    const matchesAssignee = task.assignees.some(
      a => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
    );
    return matchesTitle || matchesAssignee;
  });

  // ---- API: fetch project tasks ----

  const fetchSingleProjectItem = useCallback(async (itemId: string, token: string) => {
    try {
      const query = `
        query($itemId: ID!) {
          node(id: $itemId) {
            ... on ProjectV2Item {
              ${PROJECT_ITEM_FRAGMENT}
            }
          }
        }
      `;
      const json = await fetchGitHubGraphQL(query, { itemId }, token);
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
      const query = `
        query($projectId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              public
              fields(first: 20) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options { id name color }
                  }
                }
              }
              items(first: 50) {
                nodes {
                  ${PROJECT_ITEM_FRAGMENT}
                }
              }
            }
          }
        }
      `;
      const json = await fetchGitHubGraphQL(query, { projectId }, token);
      
      if (json.errors) {
        console.error('GraphQL Errors fetching items:', json.errors);
        setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
        setTasks([]); // Clear tasks on error to avoid showing stale data from previous project
        return;
      }

      setApiError(null);
      const projectNode = json.data?.node as GitHubProjectV2;
      const items = projectNode?.items?.nodes || [];
      const fields = projectNode?.fields?.nodes || [];

      const mappedTasks: Task[] = items.map(mapProjectItemToTask);

      // Extract all possible statuses and their colors from the project field definition.
      // This is the source of truth for the project's color configuration.
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

  // ---- API: fetch projects ----

  const fetchProjects = useCallback(async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const query = `
        query {
          viewer {
            login
            databaseId
            projectsV2(first: 20) {
              nodes { id title public }
            }
            organizations(first: 10) {
              nodes {
                login
                databaseId
                projectsV2(first: 20) {
                  nodes { id title public }
                }
              }
            }
          }
        }
      `;
      const json = await fetchGitHubGraphQL(query, {}, token);

      if (json.errors) {
        console.error('GraphQL Errors:', json.errors);
        setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
      } else {
        setApiError(null);
      }

      const viewer = json.data?.viewer;
      if (viewer) {
        const owners: ProjectOwnerInfo[] = [];
        owners.push({
          login: viewer.login,
          isOrg: false,
          databaseId: viewer.databaseId,
          projects: (viewer.projectsV2?.nodes || []).filter(Boolean),
        });

        const orgs = viewer.organizations?.nodes || [];
        for (const org of orgs) {
          if (!org || !org.login) continue;
          owners.push({
            login: org.login,
            isOrg: true,
            databaseId: org.databaseId,
            projects: (org.projectsV2?.nodes || []).filter(Boolean),
          });
        }
        setProjectsData(owners);
        setActiveTabLogin(prev => {
          if (prev && owners.some(o => o.login === prev)) {
            return prev;
          }
          return viewer.login;
        });
        updateSyncTime();
      }
      if (forceModal) {
        setIsProjectModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to fetch user projects:', e);
    } finally {
      setIsRefreshing(prev => ({ ...prev, [accountId]: false }));
    }
  }, [updateSyncTime]);

  // ---- Auth: OAuth callback ----

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code && !githubToken) {
        setIsLoadingAuth(true);
        try {
          const res = await fetch(`/api/github-oauth-callback?code=${code}`, {
            headers: { Accept: 'application/json' },
          });
          const data = await res.json();
          if (data.access_token && data.user) {
            const newAccount: GithubAccount = {
              id: data.user.id,
              login: data.user.login,
              name: data.user.name,
              avatarUrl: data.user.avatar_url,
              token: data.access_token,
            };
            setGithubAccounts(prev => {
              const filtered = prev.filter(acc => acc.id !== newAccount.id);
              const nextAccounts = [...filtered, newAccount];
              localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
              return nextAccounts;
            });
            setActiveAccountId(newAccount.id);
            window.history.replaceState({}, document.title, window.location.pathname);
            if (localStorage.getItem('pending_open_project') === 'true') {
              localStorage.removeItem('pending_open_project');
              setIsProjectModalOpen(true);
            }
          } else {
            console.error('OAuth Error:', data.error);
          }
        } catch (e) {
          console.error('Failed to authenticate:', e);
        } finally {
          setIsLoadingAuth(false);
        }
      }
    };
    handleAuthCallback();
  }, [githubToken, setActiveAccountId, setIsProjectModalOpen]);

  const handleAddAccountByToken = useCallback(async (token: string) => {
    if (!token) return { success: false, error: 'Token is required' };

    setIsLoadingAuth(true);
    setApiError(null);
    try {
      // If it's the mock token and we're in mock mode (or always allow it)
      if (token === MOCK_TOKEN) {
        const mockAccount = MOCK_ACCOUNTS_DATA[0];
        setGithubAccounts(prev => {
          const filtered = prev.filter(acc => acc.id !== mockAccount.id);
          const nextAccounts = [...filtered, mockAccount];
          localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
          return nextAccounts;
        });
        setActiveAccountId(mockAccount.id);
        setIsPatModalOpen(false);
        setIsAccountModalOpen(false);
        // If there was a pending project open, do it now
        if (localStorage.getItem('pending_open_project') === 'true') {
          localStorage.removeItem('pending_open_project');
          setIsProjectModalOpen(true);
        }
        return { success: true };
      }

      // Real GitHub API call to validate token
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        return { success: false, error: errorData.message || 'Invalid token' };
      }

      const userData = await res.json();
      const newAccount: GithubAccount = {
        id: userData.id.toString(),
        login: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        token: token,
      };

      setGithubAccounts(prev => {
        const filtered = prev.filter(acc => acc.id !== newAccount.id);
        const nextAccounts = [...filtered, newAccount];
        localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
        return nextAccounts;
      });
      setActiveAccountId(newAccount.id);
      setIsPatModalOpen(false);
      setIsAccountModalOpen(false);

      if (localStorage.getItem('pending_open_project') === 'true') {
        localStorage.removeItem('pending_open_project');
        setIsProjectModalOpen(true);
      }

      return { success: true };
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Failed to add account by token:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [setActiveAccountId, setIsProjectModalOpen, setIsAccountModalOpen]);

  // ---- Auth: check app installation ----

  useEffect(() => {
    if (activeTabLogin) {
      if (isAppInstalled[activeTabLogin] !== undefined) return; // Already checked

      const checkAppInstallation = async () => {
        try {
          const res = await fetch(`/api/check-github-app-installation?login=${activeTabLogin}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data && typeof data.installed === 'boolean') {
            setIsAppInstalled(prev => ({ ...prev, [activeTabLogin]: data.installed }));
          }
        } catch (e) {
          console.error('Failed to check app installation:', e);
        }
      };
      checkAppInstallation();
    }
  }, [activeTabLogin, isAppInstalled]);

  // ---- Initial data load ----

  useEffect(() => {
    if (githubToken && !hasProject) {
      fetchProjects(githubToken, activeAccountId, true);
    }

    if (githubToken && selectedProject) {
      // Even for dummy projects, we now fetch via fetchProjectTasks which uses the mock service
      fetchProjectTasks(selectedProject.id, githubToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubToken]);

  // ---- Supabase real-time sync ----

  useEffect(() => {
    if (!selectedProject?.id || !supabase) return;

    const projectChannelLabel = `project-${selectedProject.id}`;
    const repoNames = Array.from(new Set(tasks.map(t => t.repository).filter(Boolean)));
    const repoChannelLabels = repoNames.map(name => `repo-${name!.replace(/\//g, '-')}`);

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
                // Find the itemId for this contentId from our local state
                const task = tasks.find(t => t.contentId === contentId);
                if (task && task.itemId) {
                  fetchSingleProjectItem(task.itemId, githubToken);
                } else if (selectedProject?.id) {
                  // Not found locally? Maybe it's a new task we don't have yet.
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
      }, [selectedProject?.id, githubToken, fetchProjectTasks, tasks, fetchSingleProjectItem]);
    

  // ---- Action handlers ----

  const handleOpenAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      alert('Missing VITE_GITHUB_OAUTH_CLIENT_ID environment variable!');
      return;
    }
    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo`;
  }, []);

  const handleOpenProjectClick = useCallback(() => {
    if (githubAccounts.length > 0) {
      setIsProjectModalOpen(true);
    } else {
      localStorage.setItem('pending_open_project', 'true');
      handleOpenAuth();
    }
  }, [githubAccounts.length, handleOpenAuth]);

  const handleDisconnect = useCallback((accountId: string) => {
    setProjectHistory([]);
    localStorage.removeItem('project_history');

    setHasProject(false);
    setSelectedProject(null);
    localStorage.removeItem('selected_project');
    localStorage.removeItem('selected_project_type');
    setTasks(DUMMY_TASKS);

    const nextAccounts = githubAccounts.filter(a => a.id !== accountId);
    setGithubAccounts(nextAccounts);
    localStorage.removeItem('github_accounts');
    if (nextAccounts.length > 0) {
      localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
    }

    if (activeAccountId === accountId) {
      const nextActive = nextAccounts.length > 0 ? nextAccounts[0].id : '';
      setActiveAccountIdState(nextActive);
      localStorage.setItem('active_github_account_id', nextActive);
    }
    if (nextAccounts.length === 0) {
      setIsAccountModalOpen(false);
    }
  }, [githubAccounts, activeAccountId]);

  const handleSelectRealProject = useCallback((id: string, title: string, isPublic?: boolean) => {
    setIsProjectModalOpen(false);
    
    // Fallback logic: if isPublic is undefined (e.g. from history), check if we can find it in projectsData
    let finalPublic = isPublic;
    if (finalPublic === undefined) {
      const found = projectsData.flatMap(o => o.projects).find(p => p.id === id);
      finalPublic = found ? found.public : false; // Default to private for safety
    }

    const project = { id, title, public: finalPublic };
    setSelectedProject(project);
    setHasProject(true);
    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');

    if (githubToken) {
      fetchProjectTasks(id, githubToken);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, lastOpened: Date.now() };
    setProjectHistory(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const nextHistory = [newItem, ...filtered].slice(0, 20);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [githubToken, fetchProjectTasks, updateSyncTime, projectsData]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    setProjectHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, []);

  const fetchSearchUsers = useCallback(async (searchTerm: string): Promise<User[]> => {
    if (!githubToken || !searchTerm || searchTerm.length < 2) return [];

    try {
      // Find the current owner login to scope the search if it's an org
      const currentOwner = projectsData.find(o => o.projects.some(p => p.id === selectedProject?.id));
      
      let searchQuery = searchTerm;
      if (currentOwner?.isOrg) {
        searchQuery = `org:${currentOwner.login} ${searchTerm}`;
      } else if (currentOwner) {
        // Discovery logic requested by user:
        // Only allow global search discovery for personal projects if the project is PUBLIC.
        if (!selectedProject?.public) {
          // If private personal project, we skip global discovery and return empty for this step.
          // The UI will still show "Project Mates" from availableUsers.
          return [];
        }
        searchQuery = `${searchTerm}`;
      }

      const query = `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: USER, first: 10) {
            nodes {
              ... on User {
                id
                login
                name
                avatarUrl
              }
            }
          }
        }
      `;

      const json = await fetchGitHubGraphQL(query, { searchQuery }, githubToken);
      const nodes = (json.data?.search?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

      return nodes
        .filter(n => n && n.id && (n.login || n.name))
        .map((n, idx) => {
          const displayName = n.name || n.login || 'Unknown User';
          return {
            id: n.id!,
            name: displayName,
            avatarUrl: n.avatarUrl || '',
            initials: displayName.substring(0, 2).toUpperCase(),
            avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][idx % 5],
          };
        });
    } catch (e) {
      console.error('Search users failed:', e);
      return [];
    }
  }, [githubToken, projectsData, selectedProject?.id]);

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[]) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.contentId || !githubToken) return false;

    try {
      const mutation = `
        mutation($issueId: ID!, $assigneeIds: [ID!]!) {
          updateIssue(input: { id: $issueId, assigneeIds: $assigneeIds }) {
            issue {
              id
              assignees(first: 10) {
                nodes { id login name avatarUrl }
              }
            }
          }
        }
      `;

      const res = await fetchGitHubGraphQL(mutation, { issueId: task.contentId, assigneeIds: userIds }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);

      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      return true;
    } catch (e) {
      console.error('Update task assignees failed:', e);
      return false;
    }
  }, [tasks, githubToken, fetchSingleProjectItem]);

  const handleOpenDummyProject = useCallback(() => {
    // Add mock account if not present
    const mockAccount = MOCK_ACCOUNTS_DATA[0];
    setGithubAccounts(prev => {
      if (prev.find(a => a.id === mockAccount.id)) return prev;
      const next = [...prev, mockAccount];
      localStorage.setItem('github_accounts', JSON.stringify(next));
      return next;
    });

    // Set as active
    setActiveAccountId(mockAccount.id);

    // Select dummy project
    handleSelectRealProject(DUMMY_PROJECT_ID, 'Demo: Product Roadmap 2024');
  }, [handleSelectRealProject, setActiveAccountId]);

  const handleCreateTask = useCallback(async (title: string): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) {
      console.error('No project selected or token available');
      return false;
    }

    try {
      // Get repository from existing tasks
      let repoNameWithOwner = 'unknown/unknown';
      if (tasks.length > 0 && tasks[0].repository) {
        repoNameWithOwner = tasks[0].repository;
      }

      const [owner, repo] = repoNameWithOwner.split('/');

      // Create the issue
      const createIssueMutation = `
        mutation CreateIssue($repositoryId: ID!, $title: String!) {
          createIssue(input: {
            repositoryId: $repositoryId
            title: $title
          }) {
            issue {
              id
              number
              title
            }
          }
        }
      `;

      // First, we need to get the repository ID
      const getRepoQuery = `
        query GetRepository($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
          }
        }
      `;

      const repoResult = await fetchGitHubGraphQL(getRepoQuery, { owner, name: repo }, githubToken);
      const repositoryId = repoResult.data?.repository?.id;

      if (!repositoryId) {
        console.error('Failed to get repository ID');
        return false;
      }

      // Create the issue
      const issueResult = await fetchGitHubGraphQL(createIssueMutation, { repositoryId, title }, githubToken);
      const issueId = issueResult.data?.createIssue?.issue?.id;

      if (!issueId) {
        console.error('Failed to create issue');
        return false;
      }

      // Add the issue to the project
      const addItemMutation = `
        mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
          addProjectV2ItemById(input: {
            projectId: $projectId
            contentId: $contentId
          }) {
            item {
              id
            }
          }
        }
      `;

      const addResult = await fetchGitHubGraphQL(addItemMutation, { projectId: selectedProject.id, contentId: issueId }, githubToken);

      if (!addResult.data?.addProjectV2ItemById?.item?.id) {
        console.error('Failed to add issue to project');
        return false;
      }

      // Fetch updated tasks
      await fetchProjectTasks(selectedProject.id, githubToken);
      updateSyncTime();

      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, tasks, fetchProjectTasks, updateSyncTime]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const query = `mutation UpdateIssue($id: ID!, $title: String!) { updateIssue(input: { id: $id, title: $title }) { issue { id } } }`;
      const res = await fetchGitHubGraphQL(query, { id: task.contentId, title }, githubToken);
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
      const query = `mutation UpdateIssue($id: ID!, $body: String!) { updateIssue(input: { id: $id, body: $body }) { issue { id } } }`;
      const res = await fetchGitHubGraphQL(query, { id: task.contentId, body: description }, githubToken);
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
      const query = `mutation UpdateIssueComment($id: ID!, $body: String!) { updateIssueComment(input: { id: $id, body: $body }) { issueComment { id } } }`;
      const res = await fetchGitHubGraphQL(query, { id: commentId, body }, githubToken);
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
      const query = `mutation DeleteIssueComment($id: ID!) { deleteIssueComment(input: { id: $id }) { clientMutationId } }`;
      const res = await fetchGitHubGraphQL(query, { id: commentId }, githubToken);
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
      const query = `mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) { projectV2Item { id } } }`;
      const vars = { projectId: selectedProject.id, itemId: task.itemId, fieldId: task.projectFieldIds.status, value: { singleSelectOptionId: optionId } };
      const res = await fetchGitHubGraphQL(query, vars, githubToken);
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
      const query = `mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) { projectV2Item { id } } }`;
      
      const updateField = async (fieldId: string | undefined, dateVal: string) => {
        if (!fieldId) return;
        const vars = { projectId: selectedProject.id, itemId: task.itemId, fieldId, value: { date: new Date(dateVal).toISOString() } };
        const res = await fetchGitHubGraphQL(query, vars, githubToken);
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

  // ---- Context value ----

  const value: DashboardContextValue = {
    githubAccounts,
    activeAccountId,
    setActiveAccountId,
    githubToken,
    isLoadingAuth,
    isAppInstalled,
    isRefreshing,
    handleOpenAuth,
    handleDisconnect,

    projectsData,
    activeTabLogin,
    setActiveTabLogin,
    selectedProject,
    hasProject,
    projectHistory,
    fetchProjects,
    handleSelectRealProject,
    handleRemoveFromHistory,
    handleOpenProjectClick,
    sortMethod,
    setSortMethod,
    sortProjects: sortProjectsFn,
    groupHistoryByDate,
    apiError,

    tasks,
    isLoadingTasks,
    fetchProjectTasks,
    handleCreateTask,

    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    updateTaskStatus,
    updateTaskDates,

    lastSyncedTime,
    getSyncedTimeText,

    isProjectModalOpen,
    setIsProjectModalOpen,
    isAccountModalOpen,
    setIsAccountModalOpen,
    isPatModalOpen,
    setIsPatModalOpen,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    handleAddAccountByToken,

    isChartVisible,
    setIsChartVisible,
    selectedTaskId,
    setSelectedTaskId,

    setHasProject,
    setSelectedProject,
    setTasks,
    searchQuery,
    setSearchQuery,
    filteredTasks,
    availableUsers,
    fetchSearchUsers,
    updateTaskAssignees,
    handleOpenDummyProject,
    projectStatusOptions,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
