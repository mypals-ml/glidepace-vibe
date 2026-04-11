import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { DUMMY_TASKS } from '../lib/dummyData';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS, MOCK_PROJECTS } from '../lib/mockData';
import { fetchGitHubGraphQL } from '../lib/githubService';
import { DUMMY_PROJECT_ID, MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type { Task, User, GithubAccount, ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod } from '../types';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ========================================
// Helper: Map GitHub Project Item to Task
// ========================================

const PROJECT_ITEM_FRAGMENT = `
  id
  content {
    ... on DraftIssue { id title body }
    ... on Issue {
      id
      title
      number
      state
      body
      repository { nameWithOwner }
      assignees(first: 5) {
        nodes { login name avatarUrl }
      }
      comments(first: 10) {
        nodes {
          id
          body
          createdAt
          author { login name avatarUrl }
        }
      }
    }
    ... on PullRequest {
      id
      title
      number
      state
      body
      repository { nameWithOwner }
      assignees(first: 5) {
        nodes { login name avatarUrl }
      }
      comments(first: 10) {
        nodes {
          id
          body
          createdAt
          author { login name avatarUrl }
        }
      }
    }
  }
  fieldValues(first: 20) {
    nodes {
      ... on ProjectV2ItemFieldSingleSelectValue {
        name
        field { ... on ProjectV2SingleSelectField { name } }
      }
      ... on ProjectV2ItemFieldDateValue {
        date
        field { ... on ProjectV2Field { name } }
      }
      ... on ProjectV2ItemFieldTextValue {
        text
        field { ... on ProjectV2Field { name } }
      }
    }
  }
`;

function mapProjectItemToTask(item: any): Task {
  const content = item.content;
  const fieldValues = item.fieldValues.nodes;

  const statusField = fieldValues.find((f: any) => f.field?.name === 'Status');
  const status = statusField?.name || 'Todo';

  const startDateField = fieldValues.find((f: any) => f.field?.name?.toLowerCase().includes('start'));
  const endDateField = fieldValues.find((f: any) => f.field?.name?.toLowerCase().includes('end'));

  const startDate = startDateField?.date || new Date().toISOString().split('T')[0];
  const endDate = endDateField?.date || startDate;

  const assignees = (content?.assignees?.nodes || []).map((a: any, idx: number) => ({
    id: a.login,
    name: a.name || a.login,
    avatarUrl: a.avatarUrl,
    initials: (a.name || a.login).substring(0, 2).toUpperCase(),
    avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
  }));

  const comments = (content?.comments?.nodes || []).map((comment: any) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: {
      id: comment.author?.login || 'unknown',
      name: comment.author?.name || comment.author?.login || 'Unknown',
      avatarUrl: comment.author?.avatarUrl,
      initials: (comment.author?.name || comment.author?.login || 'UK').substring(0, 2).toUpperCase(),
      avatarColor: 'bg-slate-100 text-slate-500',
    },
  }));

  return {
    id: content?.number ? `#${content.number}` : item.id.slice(-6),
    title: content?.title || 'No Title',
    startDate: new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    endDate: new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    fullStartDate: startDate,
    fullEndDate: endDate,
    status: status === 'Done' ? 'Done' : (status === 'In Progress' ? 'In Progress' : 'Todo'),
    assignees: assignees.length > 0 ? assignees : [{ id: 'unassigned', name: 'Unassigned', initials: '??', avatarColor: 'bg-slate-100 text-slate-400' }],
    progress: status === 'Done' ? 100 : (status === 'In Progress' ? 50 : 0),
    repository: content?.repository?.nameWithOwner,
    body: content?.body || '',
    comments: comments.length > 0 ? comments : undefined,
    itemId: item.id,
    contentId: content?.id,
  };
}

// ========================================
// Context value shape
// ========================================

interface DashboardContextValue {
  // Auth
  githubAccounts: GithubAccount[];
  activeAccountId: string;
  setActiveAccountId: (id: string) => void;
  githubToken: string;
  isLoadingAuth: boolean;
  isAppInstalled: Record<string, boolean>;
  isRefreshing: Record<string, boolean>;
  handleOpenAuth: () => void;
  handleDisconnect: (accountId: string) => void;

  // Projects
  projectsData: ProjectOwnerInfo[];
  activeTabLogin: string;
  setActiveTabLogin: (login: string) => void;
  selectedProject: { id: string; title: string } | null;
  hasProject: boolean;
  projectHistory: ProjectHistoryItem[];
  fetchProjects: (token: string, accountId: string, forceModal?: boolean) => Promise<void>;
  handleSelectRealProject: (id: string, title: string) => void;
  handleRemoveFromHistory: (id: string) => void;
  handleOpenProjectClick: () => void;
  sortMethod: SortMethod;
  setSortMethod: (method: SortMethod) => void;
  sortProjects: (projects: GitHubProject[]) => GitHubProject[];
  groupHistoryByDate: () => Record<string, ProjectHistoryItem[]>;
  apiError: string | null;

  // Tasks
  tasks: Task[];
  isLoadingTasks: boolean;
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  handleCreateTask: (title: string) => Promise<boolean>;

  // Sync
  lastSyncedTime: number;
  getSyncedTimeText: (time: number) => string;

  // Modal state
  isProjectModalOpen: boolean;
  setIsProjectModalOpen: (open: boolean) => void;
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
  isPatModalOpen: boolean;
  setIsPatModalOpen: (open: boolean) => void;
  isCreateTaskModalOpen: boolean;
  setIsCreateTaskModalOpen: (open: boolean) => void;
  handleAddAccountByToken: (token: string) => Promise<{ success: boolean; error?: string }>;

  // UI state
  isChartVisible: boolean;
  setIsChartVisible: (visible: boolean) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  // Demo environment helpers
  setHasProject: (val: boolean) => void;
  setSelectedProject: (val: { id: string; title: string } | null) => void;
  setTasks: (tasks: Task[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTasks: Task[];
  availableUsers: User[];
  updateTaskAssignees: (taskId: string, userIds: string[]) => void;
  handleOpenDummyProject: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a <DashboardProvider>');
  }
  return ctx;
}

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
  const [selectedProject, setSelectedProject] = useState<{ id: string; title: string } | null>(() => {
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
  const [availableUsers] = useState<User[]>([
    { id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
    { id: 'u2', name: 'Jordan Smith', initials: 'JS', avatarColor: 'bg-indigo-100 text-indigo-700' },
    { id: 'u3', name: 'Casey Chen', initials: 'CC', avatarColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'u4', name: 'Taylor Reed', initials: 'TR', avatarColor: 'bg-rose-100 text-rose-700' },
    { id: 'u5', name: 'Morgan Lee', initials: 'ML', avatarColor: 'bg-purple-100 text-purple-700' },
    { id: 'u6', name: 'Jamie Varga', initials: 'JV', avatarColor: 'bg-cyan-100 text-cyan-700' },
  ]);

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
      const itemData = json.data?.node;

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
      const items = json.data?.node?.items?.nodes || [];

      const mappedTasks: Task[] = items.map(mapProjectItemToTask);

      setTasks(mappedTasks);
      updateSyncTime();
    } catch (e) {
      console.error('Failed to fetch project tasks:', e);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [updateSyncTime]);

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
              nodes { id title }
            }
            organizations(first: 10) {
              nodes {
                login
                databaseId
                projectsV2(first: 20) {
                  nodes { id title }
                }
              }
            }
          }
        }
      `;
      const json = await fetchGitHubGraphQL(query, {}, token);

      if (json.errors) {
        console.error('GraphQL Errors:', json.errors);
        setApiError(json.errors.map((e: any) => e.message).join(', '));
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
    } catch (e: any) {
      console.error('Failed to add account by token:', e);
      return { success: false, error: e.message || 'An unexpected error occurred' };
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
  }, [selectedProject?.id, githubToken, fetchProjectTasks, tasks]);

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

  const handleSelectRealProject = useCallback((id: string, title: string) => {
    setIsProjectModalOpen(false);
    const project = { id, title };
    setSelectedProject(project);
    setHasProject(true);
    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');

    if (githubToken) {
      fetchProjectTasks(id, githubToken);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, lastOpened: Date.now() };
    setProjectHistory(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const nextHistory = [newItem, ...filtered].slice(0, 20);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [githubToken, fetchProjectTasks, updateSyncTime]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    setProjectHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, []);

  const updateTaskAssignees = useCallback((taskId: string, userIds: string[]) => {
    const selectedUsers = availableUsers.filter(u => userIds.includes(u.id));
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, assignees: selectedUsers.length > 0 ? selectedUsers : [{ id: 'unassigned', name: 'Unassigned', initials: '??', avatarColor: 'bg-slate-100 text-slate-400' }] } : task
    ));
  }, [availableUsers]);

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
    updateTaskAssignees,
    handleOpenDummyProject,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
