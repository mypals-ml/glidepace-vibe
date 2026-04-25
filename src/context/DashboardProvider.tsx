import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { DUMMY_TASKS } from '../lib/dummyData';
import { USE_MOCK_DATA, MOCK_ACCOUNTS, MOCK_PROJECTS } from '../lib/mockData';
import { fetchViewerProjects } from '../lib/githubApi';
import { DUMMY_PROJECT_ID, MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type {
  ProjectOwnerInfo,
  ProjectHistoryItem,
  GitHubProject,
  SortMethod,
} from '../types';
import { useDashboardTasks } from '../hooks/useDashboardTasks';
import { useGithubAccounts } from '../hooks/useGithubAccounts';
import { DashboardContext } from './DashboardContext';
import type { DashboardContextValue } from './DashboardContext';

// ========================================
// Provider
// ========================================

export function DashboardProvider({ children }: { children: ReactNode }) {
  // ---- Modal state ----
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

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

  // ---- UI state ----
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // ---- Accounts hook ----
  const handleAuthSuccess = useCallback(() => {
    setIsPatModalOpen(false);
    setIsAccountModalOpen(false);
    if (localStorage.getItem('pending_open_project') === 'true') {
      localStorage.removeItem('pending_open_project');
      setIsProjectModalOpen(true);
    }
  }, []);

  const {
    githubAccounts,
    setGithubAccounts,
    activeAccountId,
    setActiveAccountId,
    githubToken,
    isLoadingAuth,
    isAppInstalled,
    isRefreshing,
    setIsRefreshing,
    handleOpenAuth,
    handleAddAccountByToken,
  } = useGithubAccounts({
    activeTabLogin,
    onAuthSuccess: handleAuthSuccess,
    onApiError: setApiError,
  });

  // ---- Task / sync hook ----
  const {
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
    fetchSearchUsers,
    handleCreateTask: handleCreateTaskFromHook,
    updateTaskStatus,
    updateTaskDates,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    updateTaskAssignees,
  } = useDashboardTasks({
    githubToken,
    selectedProject,
    activeAccountId,
    githubAccounts,
    projectsData,
    onApiError: setApiError,
  });

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

  // ---- API: fetch projects ----

  const fetchProjects = useCallback(async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const json = await fetchViewerProjects(token);

      if (json.errors) {
        console.error('GraphQL Errors:', json.errors);
        setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
      } else {
        setApiError(null);
      }

      const viewer = json.data?.viewer;
      if (viewer) {
        const notNull = <T,>(v: T | null): v is T => v !== null;
        const owners: ProjectOwnerInfo[] = [];
        owners.push({
          login: viewer.login,
          isOrg: false,
          databaseId: viewer.databaseId,
          projects: (viewer.projectsV2?.nodes || []).filter(notNull),
        });

        const orgs = viewer.organizations?.nodes || [];
        for (const org of orgs) {
          if (!org || !org.login) continue;
          owners.push({
            login: org.login,
            isOrg: true,
            databaseId: org.databaseId,
            projects: (org.projectsV2?.nodes || []).filter(notNull),
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
  }, [updateSyncTime, setIsRefreshing]);

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

  // ---- Action handlers ----

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
      setActiveAccountId(nextActive);
    }
    if (nextAccounts.length === 0) {
      setIsAccountModalOpen(false);
    }
  }, [githubAccounts, activeAccountId, setTasks, setGithubAccounts, setActiveAccountId]);

  const handleSelectRealProject = useCallback((id: string, title: string, isPublic?: boolean, forceToken?: string) => {
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
    setTasks([]); // Clear tasks immediately to prevent stale data
    setSelectedTaskId(null); // Clear selected task
    setProjectStatusOptions([]); // Clear status options

    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');

    // Use forced token, or MOCK_TOKEN for mock projects, or the current githubToken
    const isMockAccount = activeAccountId === 'mock-1';
    const isMockProject = id === DUMMY_PROJECT_ID || isMockAccount;
    const tokenToUse = forceToken || (isMockProject ? MOCK_TOKEN : githubToken);

    if (tokenToUse) {
      fetchProjectTasks(id, tokenToUse);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, lastOpened: Date.now() };
    setProjectHistory(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const nextHistory = [newItem, ...filtered].slice(0, 20);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [githubToken, fetchProjectTasks, updateSyncTime, projectsData, activeAccountId, setTasks, setProjectStatusOptions]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    setProjectHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, []);

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

    // Select dummy project with the mock token explicitly to avoid stale token issues
    handleSelectRealProject(DUMMY_PROJECT_ID, 'Demo: Product Roadmap 2024', true, mockAccount.token);
  }, [handleSelectRealProject, setActiveAccountId, setGithubAccounts]);

  const handleCreateTask = useCallback(async (taskData: {
    title: string;
    body?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    assigneeIds?: string[];
  }): Promise<boolean> => {
    const ok = await handleCreateTaskFromHook(taskData);
    if (ok) setIsCreateMode(false);
    return ok;
  }, [handleCreateTaskFromHook]);

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
    addTaskComment,
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
    isCreateMode,
    setIsCreateMode,
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
