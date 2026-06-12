import type { Task, GithubAccount, ProjectOwnerInfo, ProjectDateSettings } from '../../types';

/** Minimal mutable ref shape so sub-hooks stay decoupled from React's ref types. */
export interface MutableRef<T> {
  current: T;
}

export interface FetchProjectTasksOptions {
  /**
   * 'initial' shows the loading UI and replaces everything (project open or
   * project switch). 'background' keeps the current task list and Gantt
   * visible while fetching; it never blanks the UI, even on failure.
   */
  mode?: 'initial' | 'background';
  reason?: 'initial_load' | 'manual_sync' | 'webhook_sync' | 'external_reorder' | 'fallback';
  /** Capture and restore the viewport anchor around applying the snapshot. */
  preserveViewport?: boolean;
}

export interface SelectedProjectInfo {
  id: string;
  title: string;
  public: boolean;
  accountId?: string;
}

export interface UseDashboardTasksProps {
  githubToken: string;
  selectedProject: SelectedProjectInfo | null;
  projectsData: ProjectOwnerInfo[];
  projectAccountId: string;
  githubAccounts: GithubAccount[];
  updateSyncTime: () => void;
  setIsCreateMode: (val: boolean) => void;
  dateSettings: ProjectDateSettings;
  requestStartDateDecision: (tasks: Task[]) => Promise<'auto' | 'locked' | 'ask'>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  markRecentLocalReorder: (itemIds: string[]) => void;
  /** Registered by the layout; queues a viewport anchor for the next render. */
  captureViewportAnchor?: () => void;
}

export type SetTasks = (newTasksOrUpdater: Task[] | ((prev: Task[]) => Task[])) => void;

/**
 * Shared context threaded through the dashboard task sub-hooks so each module
 * works against the same synchronously-tracked task list and project state.
 */
export interface DashboardTasksCore {
  githubToken: string;
  selectedProject: SelectedProjectInfo | null;
  dateSettings: ProjectDateSettings;
  dateSettingsRef: MutableRef<ProjectDateSettings>;
  tasksRef: MutableRef<Task[]>;
  setTasks: SetTasks;
  updateSyncTime: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
