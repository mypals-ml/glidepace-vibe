import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DUMMY_TASKS } from '../lib/dummyData';
import { USE_MOCK_DATA, MOCK_PROJECTS } from '../lib/mockData';
import type { Task, ProjectOwnerInfo, ProjectHistoryItem } from '../types';
import type { DashboardContextValue } from './DashboardContext';
import { DashboardContext } from './DashboardContext';
import { useDashboardAuth } from '../hooks/useDashboardAuth';
import { useDashboardProjects } from '../hooks/useDashboardProjects';
import { useDashboardTasks } from '../hooks/useDashboardTasks';
import { useDashboardSync } from '../hooks/useDashboardSync';

// ========================================
// Provider
// ========================================

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  // ---- Modal state ----
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // ---- UI state ----
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // ---- Shared state (used by multiple hooks) ----
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Sync time state (shared between tasks and sync) ----
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

  // ---- Auth (hook) ----
  const auth = useDashboardAuth({
    setIsProjectModalOpen,
    setIsAccountModalOpen,
    setIsPatModalOpen,
  });

  // ---- Tasks (hook) ----
  const taskData = useDashboardTasks({
    githubToken: auth.githubToken,
    githubAccounts: auth.githubAccounts,
    activeAccountId: auth.activeAccountId,
    selectedProject,
    projectsData,
    tasks,
    setTasks,
    updateSyncTime,
    setApiError,
    setIsCreateMode,
  });

  // ---- Projects (hook) ----
  const projectOps = useDashboardProjects({
    githubToken: auth.githubToken,
    githubAccounts: auth.githubAccounts,
    activeAccountId: auth.activeAccountId,
    setSelectedProject,
    hasProject,
    setHasProject,
    projectHistory,
    setProjectHistory,
    projectsData,
    setProjectsData,
    apiError,
    setApiError,
    setIsProjectModalOpen,
    setIsRefreshing: auth.setIsRefreshing,
    setGithubAccounts: auth.setGithubAccounts,
    setActiveAccountId: auth.setActiveAccountId,
    handleOpenAuth: auth.handleOpenAuth,
    updateSyncTime,
    fetchProjectTasks: taskData.fetchProjectTasks,
    setTasks,
    setSelectedTaskId,
    setProjectStatusOptions: taskData.setProjectStatusOptions,
  });

  // ---- Supabase real-time sync (hook) ----
  useDashboardSync({
    selectedProjectId: selectedProject?.id ?? null,
    githubToken: auth.githubToken,
    tasks,
    fetchProjectTasks: taskData.fetchProjectTasks,
    fetchSingleProjectItem: taskData.fetchSingleProjectItem,
  });

  // ---- handleDisconnect (cross-domain, stays in provider) ----
  const handleDisconnect = useCallback((accountId: string) => {
    setProjectHistory([]);
    localStorage.removeItem('project_history');

    setHasProject(false);
    setSelectedProject(null);
    localStorage.removeItem('selected_project');
    localStorage.removeItem('selected_project_type');
    setTasks(DUMMY_TASKS);

    const nextAccounts = auth.githubAccounts.filter(a => a.id !== accountId);
    auth.setGithubAccounts(nextAccounts);
    localStorage.removeItem('github_accounts');
    if (nextAccounts.length > 0) {
      localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
    }

    if (auth.activeAccountId === accountId) {
      const nextActive = nextAccounts.length > 0 ? nextAccounts[0].id : '';
      auth.setActiveAccountIdState(nextActive);
      localStorage.setItem('active_github_account_id', nextActive);
    }
    if (nextAccounts.length === 0) {
      setIsAccountModalOpen(false);
    }
  }, [auth.githubAccounts, auth.activeAccountId, auth.setGithubAccounts, auth.setActiveAccountIdState]);

  // ---- Initial data load ----
  useEffect(() => {
    if (auth.githubToken && !hasProject) {
      projectOps.fetchProjects(auth.githubToken, auth.activeAccountId, true);
    }

    if (auth.githubToken && selectedProject) {
      taskData.fetchProjectTasks(selectedProject.id, auth.githubToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.githubToken]);

  // ---- Context value ----
  const value: DashboardContextValue = {
    // Auth
    githubAccounts: auth.githubAccounts,
    activeAccountId: auth.activeAccountId,
    setActiveAccountId: auth.setActiveAccountId,
    githubToken: auth.githubToken,
    isLoadingAuth: auth.isLoadingAuth,
    isAppInstalled: projectOps.isAppInstalled,
    isRefreshing: auth.isRefreshing,
    handleOpenAuth: auth.handleOpenAuth,
    handleDisconnect,

    // Projects
    projectsData,
    activeTabLogin: projectOps.activeTabLogin,
    setActiveTabLogin: projectOps.setActiveTabLogin,
    selectedProject,
    hasProject,
    projectHistory,
    fetchProjects: projectOps.fetchProjects,
    handleSelectRealProject: projectOps.handleSelectRealProject,
    handleRemoveFromHistory: projectOps.handleRemoveFromHistory,
    handleOpenProjectClick: projectOps.handleOpenProjectClick,
    sortMethod: projectOps.sortMethod,
    setSortMethod: projectOps.setSortMethod,
    sortProjects: projectOps.sortProjects,
    groupHistoryByDate: projectOps.groupHistoryByDate,
    apiError,

    // Tasks
    tasks,
    isLoadingTasks: taskData.isLoadingTasks,
    fetchProjectTasks: taskData.fetchProjectTasks,
    handleCreateTask: taskData.handleCreateTask,
    updateTaskTitle: taskData.updateTaskTitle,
    updateTaskDescription: taskData.updateTaskDescription,
    updateTaskComment: taskData.updateTaskComment,
    deleteTaskComment: taskData.deleteTaskComment,
    addTaskComment: taskData.addTaskComment,
    updateTaskStatus: taskData.updateTaskStatus,
    updateTaskDates: taskData.updateTaskDates,

    // Sync
    lastSyncedTime,
    getSyncedTimeText,

    // Modals
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
    handleAddAccountByToken: auth.handleAddAccountByToken,

    // UI
    isChartVisible,
    setIsChartVisible,
    selectedTaskId,
    setSelectedTaskId,

    // Exposed setters and derived state
    setHasProject,
    setSelectedProject,
    setTasks,
    searchQuery: taskData.searchQuery,
    setSearchQuery: taskData.setSearchQuery,
    filteredTasks: taskData.filteredTasks,
    availableUsers: taskData.availableUsers,
    fetchSearchUsers: taskData.fetchSearchUsers,
    updateTaskAssignees: taskData.updateTaskAssignees,
    handleOpenDummyProject: projectOps.handleOpenDummyProject,
    projectStatusOptions: taskData.projectStatusOptions,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
