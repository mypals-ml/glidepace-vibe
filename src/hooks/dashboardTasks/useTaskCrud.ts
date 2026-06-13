import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL, getRepositoryId, createGitHubIssue, addProjectV2Item, addProjectV2DraftIssue, updateProjectV2ItemPosition } from '../../lib/githubService';
import { getAfterIdForAppend, getAfterIdForInsertPosition, upsertTaskAfter } from '../../lib/taskOrderUtils';
import {
  UPDATE_ISSUE_TITLE_MUTATION,
  UPDATE_ISSUE_BODY_MUTATION,
  UPDATE_DRAFT_TITLE_MUTATION,
  UPDATE_DRAFT_BODY_MUTATION,
  DELETE_PROJECT_ITEM_MUTATION,
  DELETE_ISSUE_MUTATION
} from '../../lib/githubQueries';
import type { Task, TaskStatus, AutoUpdateStartDateMode, TaskInsertPosition, GroupPath } from '../../types';
import type { DashboardTasksCore } from './types';

interface UseTaskCrudProps {
  core: DashboardTasksCore;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<Task | null>;
  updateTaskStatus: (task: Task, status: TaskStatus, skipRefresh?: boolean) => Promise<boolean>;
  updateTaskDates: (task: Task, startDate?: string | null, targetDate?: string, estimate?: number, estimateUnit?: string, autoUpdateStartDate?: AutoUpdateStartDateMode, skipRefresh?: boolean) => Promise<boolean>;
  updateTaskAssignees: (taskId: string, userIds: string[], skipRefresh?: boolean) => Promise<boolean>;
  persistTaskGroupPath: (task: Task, groupPath: GroupPath) => Promise<boolean>;
  setIsCreateMode: (val: boolean) => void;
}

/** Task lifecycle: create (issue or draft), title/body edits, and delete. */
export function useTaskCrud({
  core,
  fetchSingleProjectItem,
  updateTaskStatus,
  updateTaskDates,
  updateTaskAssignees,
  persistTaskGroupPath,
  setIsCreateMode,
}: UseTaskCrudProps) {
  const { t } = useTranslation();
  const { githubToken, selectedProject, tasksRef, setTasks, updateSyncTime, showToast } = core;

  const handleCreateTask = useCallback(async (taskData: {
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
  }): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken) {
      console.error('No project selected or token available');
      return false;
    }

    const { title, body, status, startDate, targetDate, estimate, estimateUnit, autoUpdateStartDate, assigneeIds, insertPosition } = taskData;
    const createdGroupPath = insertPosition?.groupPath;

    try {
      let repoNameWithOwner: string | null = null;
      if (tasksRef.current.length > 0 && tasksRef.current[0].repository) {
        repoNameWithOwner = tasksRef.current[0].repository;
      }

      let itemId: string | null = null;
      let contentId: string | null = null;

      if (repoNameWithOwner) {
        const [owner, repo] = repoNameWithOwner.split('/');
        const repositoryId = await getRepositoryId(owner, repo, githubToken);

        if (repositoryId) {
          contentId = await createGitHubIssue(repositoryId, title, body, githubToken);
          if (contentId) {
            itemId = await addProjectV2Item(selectedProject.id, contentId, githubToken);
          }
        }
      }

      if (!itemId) {
        itemId = await addProjectV2DraftIssue(selectedProject.id, title, body, githubToken);
      }

      if (!itemId) {
        console.error('Failed to create task');
        return false;
      }

      const tempTask: Task = {
        id: itemId,
        displayId: itemId.slice(-6),
        itemId: itemId,
        contentId: contentId || undefined,
        title,
        status: 'Todo',
        startDate: '',
        targetDate: '',
        estimate: estimate || 0,
        estimateUnit: estimateUnit,
        assignees: [],
        progress: 0,
        projectFieldIds: tasksRef.current.length > 0 ? tasksRef.current[0].projectFieldIds : undefined,
        statusOptions: tasksRef.current.length > 0 ? tasksRef.current[0].statusOptions : undefined,
        autoUpdateStartDate: autoUpdateStartDate,
        groupPath: createdGroupPath ? [...createdGroupPath] : [],
      };

      if (status && tempTask.statusOptions) {
        await updateTaskStatus(tempTask, status, true);
      }
      if (startDate || targetDate || estimate !== undefined || estimateUnit !== undefined || autoUpdateStartDate !== undefined) {
        await updateTaskDates(tempTask, startDate, targetDate, estimate, estimateUnit, autoUpdateStartDate, true);
      }
      if (assigneeIds && assigneeIds.length > 0 && contentId) {
        await updateTaskAssignees(itemId, assigneeIds, true);
      }
      if (createdGroupPath) {
        await persistTaskGroupPath(tempTask, createdGroupPath);
      }

      let positionedAfterId: string | null | undefined;
      const afterId = insertPosition
        ? getAfterIdForInsertPosition(tasksRef.current, insertPosition)
        : getAfterIdForAppend(tasksRef.current);
      if (insertPosition || afterId !== null) {
        const moved = await updateProjectV2ItemPosition(selectedProject.id, itemId, afterId, githubToken);
        if (!moved) {
          showToast(t('dashboard.taskInsertPositionFailed', 'Task was created, but could not be moved to the requested position.'), 'error');
        } else {
          positionedAfterId = afterId;
        }
      }

      console.log(`[DashboardTasks] 🚀 Creation sequence complete, performing final fetch for: ${itemId}`);
      const fetchedTask = await fetchSingleProjectItem(itemId, githubToken);
      if (positionedAfterId !== undefined) {
        setTasks(prev => upsertTaskAfter(prev, fetchedTask || tempTask, positionedAfterId));
      }

      setIsCreateMode(false);
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [selectedProject?.id, githubToken, fetchSingleProjectItem, updateTaskStatus, updateTaskDates, updateTaskAssignees, persistTaskGroupPath, setTasks, setIsCreateMode, showToast, t, tasksRef]);

  const updateTaskTitle = useCallback(async (task: Task, title: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t =>
        (t.id === task.id || t.itemId === task.itemId)
          ? { ...t, title, localUpdateTimestamp: now }
          : t
      ));
      const mutation = task.isDraft ? UPDATE_DRAFT_TITLE_MUTATION : UPDATE_ISSUE_TITLE_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, title }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) await fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks]);

  const updateTaskDescription = useCallback(async (task: Task, description: string): Promise<boolean> => {
    if (!task.contentId || !githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t =>
        (t.id === task.id || t.itemId === task.itemId)
          ? { ...t, body: description, localUpdateTimestamp: now }
          : t
      ));
      const mutation = task.isDraft ? UPDATE_DRAFT_BODY_MUTATION : UPDATE_ISSUE_BODY_MUTATION;
      const res = await fetchGitHubGraphQL(mutation, { id: task.contentId, body: description }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) await fetchSingleProjectItem(task.itemId, githubToken);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks]);

  const deleteTask = useCallback(async (task: Task): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    try {
      if (task.contentId && !task.isDraft) {
        const issueRes = await fetchGitHubGraphQL(
          DELETE_ISSUE_MUTATION,
          { issueId: task.contentId },
          githubToken
        );
        if (issueRes.errors) throw new Error(issueRes.errors[0]?.message);
      }

      const projectItemRes = await fetchGitHubGraphQL(
        DELETE_PROJECT_ITEM_MUTATION,
        { projectId: selectedProject.id, itemId: task.itemId },
        githubToken
      );
      if (projectItemRes.errors) {
        const message = projectItemRes.errors[0]?.message || '';
        if (!message.toLowerCase().includes('not found') && !message.toLowerCase().includes('could not resolve')) {
          throw new Error(message);
        }
      }

      setTasks(prev => prev.filter(t => t.itemId !== task.itemId && t.id !== task.id));
      updateSyncTime();
      return true;
    } catch (e) {
      console.error('Delete task failed:', e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, setTasks, updateSyncTime, tasksRef]);

  return {
    handleCreateTask,
    updateTaskTitle,
    updateTaskDescription,
    deleteTask,
  };
}
