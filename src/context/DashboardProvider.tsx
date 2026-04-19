import { useEffect, useCallback, useState, type ReactNode } from 'react';
import { DUMMY_PROJECT_ID, MOCK_ACCOUNTS_DATA } from '../lib/githubMock';
import { DUMMY_TASKS } from '../lib/dummyData';

import { DashboardContext } from './DashboardContext';
import type { DashboardContextValue } from './DashboardContext';
import type { Task, SortMethod } from '../types';

// Hooks
import { useDashboardModals } from '../hooks/dashboard/useDashboardModals';
import { useDashboardAuth } from '../hooks/dashboard/useDashboardAuth';
import { useDashboardProjects } from '../hooks/dashboard/useDashboardProjects';
import { useDashboardTasks } from '../hooks/dashboard/useDashboardTasks';
import { useDashboardSync } from '../hooks/dashboard/useDashboardSync';
import { useDashboardUI } from '../hooks/dashboard/useDashboardUI';

export function DashboardProvider({ children }: { children: ReactNode }) {
  // 0. Shared Sync State (Extracted to avoid circular dependency)
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('last_synced_time');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const updateSyncTime = useCallback(() => {
    const now = Date.now();
    setLastSyncedTime(now);
    localStorage.setItem('last_synced_time', now.toString());
  }, []);

  // 1. Independent Hooks
  const modals = useDashboardModals();
  const ui = useDashboardUI();

  // 2. Auth Hook (Needs Modal Setters)
  const auth = useDashboardAuth({
    setIsProjectModalOpen: modals.setIsProjectModalOpen,
    setIsPatModalOpen: modals.setIsPatModalOpen,
    setIsAccountModalOpen: modals.setIsAccountModalOpen,
  });

  // 3. Projects Hook (Needs Auth state & Sync update)
  const projects = useDashboardProjects({
    githubToken: auth.githubToken,
    activeAccountId: auth.activeAccountId,
    updateSyncTime,
    setIsProjectModalOpen: modals.setIsProjectModalOpen,
  });

  // 4. Tasks Hook (Needs Auth & Projects state)
  const tasks = useDashboardTasks({
    githubToken: auth.githubToken,
    selectedProject: projects.selectedProject,
    updateSyncTime,
    githubAccounts: auth.githubAccounts,
    activeAccountId: auth.activeAccountId,
    setIsCreateMode: modals.setIsCreateMode,
    projectsData: projects.projectsData,
  });

  // 6. Sync Hook (Needs everything)
  const sync = useDashboardSync({
    selectedProject: projects.selectedProject,
    githubToken: auth.githubToken,
    tasks: tasks.tasks,
    fetchProjectTasks: tasks.fetchProjectTasks,
    fetchSingleProjectItem: tasks.fetchSingleProjectItem,
    updateSyncTime,
  });

  // Orchestration Handlers
  const handleOpenProjectClick = useCallback(() => {
    if (auth.githubAccounts.length > 0) {
      modals.setIsProjectModalOpen(true);
    } else {
      localStorage.setItem('pending_open_project', 'true');
      auth.handleOpenAuth();
    }
  }, [auth.githubAccounts.length, auth.handleOpenAuth, modals.setIsProjectModalOpen]);

  const handleOpenDummyProject = useCallback(() => {
    const mockAccount = MOCK_ACCOUNTS_DATA[0];
    auth.setGithubAccounts(prev => {
      if (prev.find(a => a.id === mockAccount.id)) return prev;
      const next = [...prev, mockAccount];
      localStorage.setItem('github_accounts', JSON.stringify(next));
      return next;
    });
    auth.setActiveAccountId(mockAccount.id);
    projects.handleSelectRealProject(DUMMY_PROJECT_ID, 'Demo: Product Roadmap 2024', true, mockAccount.token);
  }, [auth, projects]);

  const handleDisconnect = useCallback((accountId: string) => {
    projects.setProjectHistory([]);
    localStorage.removeItem('project_history');
    projects.setHasProject(false);
    projects.setSelectedProject(null);
    localStorage.removeItem('selected_project');
    localStorage.removeItem('selected_project_type');
    tasks.setTasks(DUMMY_TASKS);
    auth.handleDisconnect(accountId);
  }, [projects, tasks, auth]);

  // Orchestration: Fetch tasks when project selection changes
  useEffect(() => {
    if (projects.selectedProject && auth.githubToken) {
      // Clear current UI state for the new project
      tasks.setTasks([]);
      ui.setSelectedTaskId(null);
      tasks.setProjectStatusOptions([]);
      
      const isMockAccount = auth.activeAccountId === 'mock-1';
      const isMockProject = projects.selectedProject.id === DUMMY_PROJECT_ID || isMockAccount;
      const tokenToUse = isMockProject ? 'mock-token' : auth.githubToken;
      
      tasks.fetchProjectTasks(projects.selectedProject.id, tokenToUse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.selectedProject?.id, auth.githubToken, auth.activeAccountId, tasks.fetchProjectTasks]);

  // Initial Data Load (Fetching list of projects)
  useEffect(() => {
    if (auth.githubToken && !projects.hasProject) {
      projects.fetchProjects(auth.githubToken, auth.activeAccountId, true);
    }
  }, [auth.githubToken, auth.activeAccountId, projects.hasProject, projects.fetchProjects, projects]);

  const value: DashboardContextValue = {
    // Auth
    githubAccounts: auth.githubAccounts,
    activeAccountId: auth.activeAccountId,
    setActiveAccountId: (id: string) => auth.setActiveAccountId(id),
    githubToken: auth.githubToken,
    isLoadingAuth: auth.isLoadingAuth,
    isAppInstalled: auth.isAppInstalled,
    isRefreshing: { ...auth.isRefreshing, ...projects.isRefreshingProjects },
    handleOpenAuth: auth.handleOpenAuth,
    handleDisconnect,

    // Projects
    projectsData: projects.projectsData,
    activeTabLogin: projects.activeTabLogin,
    setActiveTabLogin: (login: string) => projects.setActiveTabLogin(login),
    selectedProject: projects.selectedProject,
    hasProject: projects.hasProject,
    projectHistory: projects.projectHistory,
    fetchProjects: projects.fetchProjects,
    handleSelectRealProject: projects.handleSelectRealProject,
    handleRemoveFromHistory: projects.handleRemoveFromHistory,
    handleOpenProjectClick,
    sortMethod: projects.sortMethod,
    setSortMethod: (method: SortMethod) => projects.setSortMethod(method),
    sortProjects: projects.sortProjects,
    groupHistoryByDate: projects.groupHistoryByDate,
    apiError: projects.apiError || tasks.apiError,

    // Tasks
    tasks: tasks.tasks,
    isLoadingTasks: tasks.isLoadingTasks,
    fetchProjectTasks: tasks.fetchProjectTasks,
    handleCreateTask: tasks.handleCreateTask,
    updateTaskTitle: tasks.updateTaskTitle,
    updateTaskDescription: tasks.updateTaskDescription,
    updateTaskComment: tasks.updateTaskComment,
    deleteTaskComment: tasks.deleteTaskComment,
    addTaskComment: tasks.addTaskComment,
    updateTaskStatus: tasks.updateTaskStatus,
    updateTaskDates: tasks.updateTaskDates,

    // Sync
    lastSyncedTime,
    getSyncedTimeText: sync.getSyncedTimeText,

    // Modals
    isProjectModalOpen: modals.isProjectModalOpen,
    setIsProjectModalOpen: (open: boolean) => modals.setIsProjectModalOpen(open),
    isAccountModalOpen: modals.isAccountModalOpen,
    setIsAccountModalOpen: (open: boolean) => modals.setIsAccountModalOpen(open),
    isPatModalOpen: modals.isPatModalOpen,
    setIsPatModalOpen: (open: boolean) => modals.setIsPatModalOpen(open),
    isCreateTaskModalOpen: modals.isCreateTaskModalOpen,
    setIsCreateTaskModalOpen: (open: boolean) => modals.setIsCreateTaskModalOpen(open),
    isCreateMode: modals.isCreateMode,
    setIsCreateMode: (open: boolean) => modals.setIsCreateMode(open),
    handleAddAccountByToken: auth.handleAddAccountByToken,

    // UI
    isChartVisible: ui.isChartVisible,
    setIsChartVisible: (visible: boolean) => ui.setIsChartVisible(visible),
    selectedTaskId: ui.selectedTaskId,
    setSelectedTaskId: (id: string | null) => ui.setSelectedTaskId(id),

    // Status & Search
    projectStatusOptions: tasks.projectStatusOptions,
    setHasProject: (val: boolean) => projects.setHasProject(val),
    setSelectedProject: (val: { id: string; title: string; public: boolean } | null) => projects.setSelectedProject(val),
    setTasks: (t: Task[]) => tasks.setTasks(t),
    searchQuery: tasks.searchQuery,
    setSearchQuery: (query: string) => tasks.setSearchQuery(query),
    filteredTasks: tasks.filteredTasks,
    availableUsers: tasks.availableUsers,
    fetchSearchUsers: tasks.fetchSearchUsers,
    updateTaskAssignees: tasks.updateTaskAssignees,
    handleOpenDummyProject,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
