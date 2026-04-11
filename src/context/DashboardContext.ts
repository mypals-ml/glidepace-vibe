import { createContext, useContext } from 'react';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod } from '../types';

export interface DashboardContextValue {
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

  updateTaskTitle: (task: Task, title: string) => Promise<boolean>;
  updateTaskDescription: (task: Task, description: string) => Promise<boolean>;
  updateTaskComment: (task: Task, commentId: string, body: string) => Promise<boolean>;
  deleteTaskComment: (task: Task, commentId: string) => Promise<boolean>;
  updateTaskStatus: (task: Task, status: TaskStatus) => Promise<boolean>;
  updateTaskDates: (task: Task, startDate?: string, endDate?: string) => Promise<boolean>;

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

  // Status
  projectStatusOptions: string[];

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

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a <DashboardProvider>');
  }
  return ctx;
}
