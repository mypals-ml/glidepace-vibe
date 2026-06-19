import { createContext, useContext } from 'react';
import type { Task, TaskStatus, User, GithubAccount, ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod, GitHubProjectV2Field, ProjectDateSettings, AutoUpdateStartDateMode, TaskInsertPosition, DashboardItem, GroupPath } from '../types';
import type { MissingFieldDef } from '../hooks/useFieldSetup';
import type { DashboardFieldValueChange } from '../lib/taskOrderUtils';
import type { FetchProjectTasksOptions } from '../hooks/useDashboardTasks';
import type { ViewportAnchor } from '../lib/viewportAnchor';

export interface DashboardContextValue {
  // Auth
  githubAccounts: GithubAccount[];
  browsingAccountId: string;
  setBrowsingAccountId: (id: string) => void;
  browsingToken: string;
  githubToken: string;
  isLoadingAuth: boolean;
  isAppInstalled: Record<string, boolean>;
  isRefreshing: Record<string, boolean>;
  handleOpenAuth: () => void;
  handleDisconnect: (accountId: string) => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
  getTokenById: (id: string | undefined) => string;

  // Projects
  projectsData: ProjectOwnerInfo[];
  activeTabLogin: string;
  setActiveTabLogin: (login: string) => void;
  selectedProject: { id: string; title: string; public: boolean; accountId?: string } | null;
  hasProject: boolean;
  projectHistory: ProjectHistoryItem[];
  fetchProjects: (token: string, accountId: string, forceModal?: boolean) => Promise<void>;
  refreshProjects: () => void;
  handleSelectRealProject: (id: string, title: string, isPublic: boolean, accountId: string) => void;
  handleRemoveFromHistory: (id: string) => void;
  handleOpenProjectClick: () => void;
  sortMethod: SortMethod;
  setSortMethod: (method: SortMethod) => void;
  sortProjects: (projects: GitHubProject[]) => GitHubProject[];
  groupHistoryByDate: () => Record<string, ProjectHistoryItem[]>;
  apiError: string | null;
  projectFields: GitHubProjectV2Field[];
  dateSettings: ProjectDateSettings;
  updateDateSettings: (settings: ProjectDateSettings) => void;

  // Tasks
  tasks: Task[];
  dashboardItems: DashboardItem[];
  selectedGroupFieldIds: string[];
  setSelectedGroupFieldIds: (fieldIds: string[]) => void;
  isLoadingTasks: boolean;
  isRefreshingTasks: boolean;
  fieldsProgress: { current: number; total: number; isFetching: boolean };
  fetchProjectTasks: (projectId: string, token: string, options?: FetchProjectTasksOptions) => Promise<void>;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<Task | null>;

  // Viewport anchoring (background refresh scroll preservation)
  registerViewportAnchorController: (capture: (() => ViewportAnchor | null) | null) => void;
  consumePendingViewportAnchor: () => ViewportAnchor | null;
  fetchTaskComments: (taskId: string, contentId: string, token: string) => Promise<void>;
  isFetchingComments: Record<string, boolean>;
  handleCreateTask: (taskData: { 
    title: string; 
    body?: string; 
    status?: string; 
    startDate?: string; 
    targetDate?: string; 
    estimate?: number;
    estimateUnit?: string;
    autoUpdateStartDate?: AutoUpdateStartDateMode;
    assigneeIds?: string[];
    insertPosition?: TaskInsertPosition | null;
  }) => Promise<boolean>;

  updateTaskTitle: (task: Task, title: string) => Promise<boolean>;
  updateTaskDescription: (task: Task, description: string) => Promise<boolean>;
  updateTaskComment: (task: Task, commentId: string, body: string) => Promise<boolean>;
  deleteTaskComment: (task: Task, commentId: string) => Promise<boolean>;
  addTaskComment: (task: Task, body: string) => Promise<boolean>;
  deleteTask: (task: Task) => Promise<boolean>;
  updateTaskStatus: (task: Task, status: TaskStatus) => Promise<boolean>;
  updateTaskDates: (task: Task, startDate?: string | null, targetDate?: string, estimate?: number, estimateUnit?: string, autoUpdateStartDate?: AutoUpdateStartDateMode) => Promise<boolean>;
  updateTaskSuccessors: (taskId: string, successorIds: string[], skipRefresh?: boolean, decision?: 'auto' | 'locked' | 'ask') => Promise<boolean>;
  updateTaskGroupPath: (taskId: string, groupPath: GroupPath) => Promise<boolean>;
  renameGroupBlock: (groupBlockId: string, name: string) => Promise<boolean>;
  ungroupGroupBlock: (groupBlockId: string) => Promise<boolean>;
  toggleGroupBlockCollapsed: (groupBlockId: string) => void;
  reorderTask: (taskId: string, afterTaskId: string | null) => Promise<boolean>;
  reorderTaskBlock: (taskIds: string[], afterTaskId: string | null) => Promise<boolean>;
  moveTaskToGroupPath: (taskId: string, groupPath: GroupPath, afterTaskId: string | null, fieldValueChanges?: DashboardFieldValueChange[]) => Promise<boolean>;
  createProjectV2Field: (name: string, dataType: string, singleSelectOptions?: { name: string; description: string; color: string }[]) => Promise<string | null>;

  // Sync
  lastSyncedTime: number;
  getSyncedTimeText: (time: number) => string;

  // Modal state
  isProjectModalOpen: boolean;
  setIsProjectModalOpen: (open: boolean) => void;
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
  isAboutModalOpen: boolean;
  setIsAboutModalOpen: (open: boolean) => void;
  isPatModalOpen: boolean;
  setIsPatModalOpen: (open: boolean) => void;
  isCreateTaskModalOpen: boolean;
  setIsCreateTaskModalOpen: (open: boolean) => void;
  isCreateMode: boolean;
  setIsCreateMode: (open: boolean) => void;
  isProjectSettingsModalOpen: boolean;
  setIsProjectSettingsModalOpen: (open: boolean) => void;
  handleAddAccountByToken: (token: string) => Promise<{ success: boolean; account?: GithubAccount; error?: string }>;

  // Missing Fields Prompt
  isMissingFieldsPromptOpen: boolean;
  setIsMissingFieldsPromptOpen: (open: boolean) => void;
  missingFieldsList: MissingFieldDef[];
  triggerFieldDetection: (forcePrompt?: boolean) => void;
  promptCreateSingleField: (settingsKey: MissingFieldDef['settingsKey']) => void;
  createSingleFieldNow: (settingsKey: MissingFieldDef['settingsKey']) => Promise<void>;
  handleCreateMissingFields: () => Promise<void>;
  isCreatingFields: boolean;
  mappingStatus: 'idle' | 'scanning' | 'mapping' | 'complete';
  
  // Start Date Update Mode Prompt
  isStartDatePromptOpen: boolean;
  setIsStartDatePromptOpen: (open: boolean) => void;
  startDatePromptTasks: Task[];
  requestStartDateDecision: (tasks: Task[]) => Promise<'auto' | 'locked' | 'ask'>;
  onStartDatePromptDecision: (decision: 'auto' | 'locked' | 'ask', tasks: Task[]) => void;

  // UI state
  isChartVisible: boolean;
  setIsChartVisible: (visible: boolean) => void;
  dashboardView: 'gantt' | 'forecast';
  setDashboardView: (view: 'gantt' | 'forecast') => void;
  isTaskDetailsOpen: boolean;
  setIsTaskDetailsOpen: (open: boolean) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  isLinkMode: boolean;
  setIsLinkMode: (mode: boolean) => void;
  selectedLinkTaskIds: string[];
  setSelectedLinkTaskIds: (tasks: string[] | ((prev: string[]) => string[])) => void;
  pendingTaskInsertPosition: TaskInsertPosition | null;
  setPendingTaskInsertPosition: (position: TaskInsertPosition | null) => void;

  // Status
  projectStatusOptions: string[];

  // Demo environment helpers
  setHasProject: (val: boolean) => void;
  setSelectedProject: (val: { id: string; title: string; public: boolean; accountId?: string } | null) => void;
  setTasks: (tasks: Task[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTasks: Task[];
  availableUsers: User[];
  fetchSearchUsers: (query: string, repository?: string) => Promise<User[]>;
  updateTaskAssignees: (taskId: string, userIds: string[]) => Promise<boolean>;
  
  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Timeline / Gantt navigation
  requestedCenterDate: string | null;
  requestedCenterTaskId: string | null;
  centerGanttOnDate: (date: string | null) => void;
  centerGanttOnTask: (taskId: string, date: string | null) => void;
  completeGanttCenterRequest: () => void;

  // Gantt zoom (horizontal only; 50-100 integer percent)
  ganttZoomPercent: number;
  setGanttZoomPercent: (percent: number | ((prev: number) => number)) => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a <DashboardProvider>');
  }
  return ctx;
}
