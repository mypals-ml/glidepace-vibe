import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTaskFetch } from './dashboardTasks/useTaskFetch';
import { useTaskComments } from './dashboardTasks/useTaskComments';
import { useTaskMutations } from './dashboardTasks/useTaskMutations';
import { useTaskGrouping } from './dashboardTasks/useTaskGrouping';
import { useTaskOrdering } from './dashboardTasks/useTaskOrdering';
import { useTaskCrud } from './dashboardTasks/useTaskCrud';
import { useUserSearch } from './dashboardTasks/useUserSearch';
import type { DashboardTasksCore, UseDashboardTasksProps } from './dashboardTasks/types';
import type { Task, User } from '../types';

export type { FetchProjectTasksOptions } from './dashboardTasks/types';

/**
 * Composes the dashboard task modules (fetching, comments, field mutations,
 * grouping, ordering, CRUD, and user search) around a single synchronously-
 * tracked task list. Each concern lives in `./dashboardTasks/`.
 */
export function useDashboardTasks({
  githubToken,
  selectedProject,
  projectsData,
  projectAccountId,
  githubAccounts,
  updateSyncTime,
  setIsCreateMode,
  dateSettings,
  requestStartDateDecision,
  showToast,
  markRecentLocalReorder,
  captureViewportAnchor,
}: UseDashboardTasksProps) {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const setTasks = useCallback((newTasksOrUpdater: Task[] | ((prev: Task[]) => Task[])) => {
    if (Array.isArray(newTasksOrUpdater)) {
      tasksRef.current = newTasksOrUpdater;
    }
    setTasksState(prev => {
      const next = typeof newTasksOrUpdater === 'function' ? newTasksOrUpdater(prev) : newTasksOrUpdater;
      tasksRef.current = next;
      return next;
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');

  const dateSettingsRef = useRef(dateSettings);
  useEffect(() => {
    dateSettingsRef.current = dateSettings;
  }, [dateSettings]);

  const captureViewportAnchorRef = useRef(captureViewportAnchor);
  useEffect(() => {
    captureViewportAnchorRef.current = captureViewportAnchor;
  }, [captureViewportAnchor]);

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
      const matchesId = task.displayId.toLowerCase().includes(query);
      const matchesAssignee = (task.assignees || []).some(
        a => a.name.toLowerCase().includes(query) || (a.login && a.login.toLowerCase().includes(query))
      );
      return matchesTitle || matchesId || matchesAssignee;
    });
  }, [tasks, searchQuery]);

  const core: DashboardTasksCore = {
    githubToken,
    selectedProject,
    dateSettings,
    dateSettingsRef,
    tasksRef,
    setTasks,
    updateSyncTime,
    showToast,
  };

  const {
    isLoadingTasks,
    setIsLoadingTasks,
    isRefreshingTasks,
    projectStatusOptions,
    setProjectStatusOptions,
    projectFields,
    fieldsProgress,
    apiError,
    fetchSingleProjectItem,
    fetchProjectTasks,
  } = useTaskFetch({ core, projectAccountId, captureViewportAnchorRef });

  const {
    isFetchingComments,
    fetchTaskComments,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
  } = useTaskComments({ core });

  const {
    updateTaskAssignees,
    updateTaskStatus,
    updateTaskDates,
    updateTaskSuccessors,
  } = useTaskMutations({ core, fetchSingleProjectItem, projectFields, requestStartDateDecision });

  const {
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
    dashboardItems,
    toggleGroupBlockCollapsed,
    persistTaskGroupPath,
    updateTaskGroupPath,
    renameGroupBlock,
    ungroupGroupBlock,
  } = useTaskGrouping({ core, filteredTasks, projectFields });

  const {
    reorderTask,
    reorderTaskBlock,
    moveTaskToGroupPath,
  } = useTaskOrdering({ core, projectFields, persistTaskGroupPath, fetchProjectTasks, markRecentLocalReorder });

  const {
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    deleteTask,
  } = useTaskCrud({ core, fetchSingleProjectItem, updateTaskStatus, updateTaskDates, updateTaskAssignees, persistTaskGroupPath, setIsCreateMode });

  const { fetchSearchUsers } = useUserSearch({ githubToken, selectedProject, projectsData, projectAccountId, githubAccounts });

  return {
    tasks,
    dashboardItems,
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
    setTasks,
    isLoadingTasks,
    isRefreshingTasks,
    setIsLoadingTasks,
    searchQuery,
    setSearchQuery,
    projectStatusOptions,
    setProjectStatusOptions,
    projectFields,
    fieldsProgress,
    apiError,
    availableUsers,
    filteredTasks,
    fetchProjectTasks,
    fetchSingleProjectItem,
    updateTaskAssignees,
    updateTaskStatus,
    updateTaskDates,
    updateTaskSuccessors,
    updateTaskGroupPath,
    renameGroupBlock,
    ungroupGroupBlock,
    toggleGroupBlockCollapsed,
    reorderTask,
    reorderTaskBlock,
    moveTaskToGroupPath,
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
    deleteTask,
    fetchSearchUsers,
    fetchTaskComments,
    isFetchingComments,
  };
}
