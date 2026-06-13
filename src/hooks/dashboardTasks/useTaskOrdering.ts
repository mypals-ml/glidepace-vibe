import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProjectV2ItemField, clearProjectV2ItemField, updateProjectV2ItemPosition } from '../../lib/githubService';
import { getTaskOrderId, moveTaskAfter, moveTaskBlockAfter, type DashboardFieldValueChange } from '../../lib/taskOrderUtils';
import { serializeGroupPath, moveTasksToGroupPath } from '../../lib/taskGroupUtils';
import { logDashboardEvent } from '../../lib/dashboardDebugLog';
import { applyTaskFieldValueChanges, getProjectFieldUpdateValue } from './taskFieldHelpers';
import type { Task, GitHubProjectV2Field, GroupPath } from '../../types';
import type { DashboardTasksCore, FetchProjectTasksOptions } from './types';

interface UseTaskOrderingProps {
  core: DashboardTasksCore;
  projectFields: GitHubProjectV2Field[];
  persistTaskGroupPath: (task: Task, groupPath: GroupPath) => Promise<boolean>;
  fetchProjectTasks: (projectId: string, token: string, options?: FetchProjectTasksOptions) => Promise<void>;
  markRecentLocalReorder: (itemIds: string[]) => void;
}

/**
 * Task ordering mutations: single-task reorder, contiguous block reorder, and
 * cross-group moves (group path + field value + position in one operation).
 */
export function useTaskOrdering({ core, projectFields, persistTaskGroupPath, fetchProjectTasks, markRecentLocalReorder }: UseTaskOrderingProps) {
  const { t } = useTranslation();
  const { githubToken, tasksRef, setTasks, updateSyncTime, showToast } = core;
  const selectedProjectId = core.selectedProject?.id;

  const reorderTask = useCallback(async (taskId: string, afterTaskId: string | null): Promise<boolean> => {
    if (!selectedProjectId || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || getTaskOrderId(t) === taskId);
    if (!task?.itemId) return false;

    const nextTasks = moveTaskAfter(oldTasks, getTaskOrderId(task), afterTaskId);
    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    if (oldOrder === nextOrder) return true;

    logDashboardEvent('[DashboardTasks] Reorder started', {
      reorderKind: 'single_task',
      projectId: selectedProjectId,
      taskId,
      itemId: task.itemId,
      afterTaskId,
    });
    setTasks(nextTasks);
    const success = await updateProjectV2ItemPosition(selectedProjectId, task.itemId, afterTaskId, githubToken);
    if (success) {
      logDashboardEvent('[DashboardTasks] Reorder completed', {
        reorderKind: 'single_task',
        projectId: selectedProjectId,
        movedItemIds: [task.itemId],
        afterTaskId,
      });
      markRecentLocalReorder([task.itemId]);
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Reorder failed', {
      reorderKind: 'single_task',
      projectId: selectedProjectId,
      movedItemIds: [task.itemId],
      afterTaskId,
    }, 'warn');
    showToast(t('dashboard.taskReorderFailed', 'Failed to reorder task.'), 'error');
    return false;
  }, [selectedProjectId, githubToken, setTasks, markRecentLocalReorder, updateSyncTime, showToast, t, tasksRef]);

  const reorderTaskBlock = useCallback(async (taskIds: string[], afterTaskId: string | null): Promise<boolean> => {
    if (!selectedProjectId || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const nextTasks = moveTaskBlockAfter(oldTasks, taskIds, afterTaskId);
    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    if (oldOrder === nextOrder) return true;

    const movedTasks = taskIds
      .map(taskId => nextTasks.find(task => task.id === taskId || getTaskOrderId(task) === taskId))
      .filter((task): task is Task => Boolean(task?.itemId));
    if (movedTasks.length !== taskIds.length) return false;

    logDashboardEvent('[DashboardTasks] Reorder started', {
      reorderKind: 'task_block',
      projectId: selectedProjectId,
      taskIds,
      movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
      afterTaskId,
    });
    setTasks(nextTasks);

    let success = true;
    let currentAfterId = afterTaskId;
    for (const movedTask of movedTasks) {
      const moved = await updateProjectV2ItemPosition(selectedProjectId, movedTask.itemId!, currentAfterId, githubToken);
      if (!moved) {
        success = false;
        break;
      }
      currentAfterId = movedTask.itemId!;
    }

    if (success) {
      logDashboardEvent('[DashboardTasks] Reorder completed', {
        reorderKind: 'task_block',
        projectId: selectedProjectId,
        movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
        afterTaskId,
      });
      markRecentLocalReorder(movedTasks.map(movedTask => movedTask.itemId!));
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Reorder failed', {
      reorderKind: 'task_block',
      projectId: selectedProjectId,
      movedItemIds: movedTasks.map(movedTask => movedTask.itemId),
      afterTaskId,
      fallbackRefreshKind: 'full_project',
    }, 'warn');
    showToast(t('dashboard.taskReorderFailed', 'Failed to reorder task.'), 'error');
    await fetchProjectTasks(selectedProjectId, githubToken, { mode: 'background', reason: 'fallback', preserveViewport: true });
    return false;
  }, [selectedProjectId, githubToken, setTasks, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks, tasksRef]);

  const moveTaskToGroupPath = useCallback(async (
    taskId: string,
    groupPath: GroupPath,
    afterTaskId: string | null,
    fieldValueChanges: DashboardFieldValueChange[] = []
  ): Promise<boolean> => {
    if (!selectedProjectId || !githubToken) return false;

    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || getTaskOrderId(t) === taskId);
    if (!task?.itemId) return false;

    const taskOrderId = getTaskOrderId(task);
    const timestamp = Date.now();
    const groupedTasks = moveTasksToGroupPath(oldTasks, [taskOrderId], groupPath).map(candidate =>
      getTaskOrderId(candidate) === taskOrderId || candidate.id === task.id
        ? {
            ...applyTaskFieldValueChanges(candidate, fieldValueChanges),
            localUpdateTimestamp: timestamp,
          }
        : candidate
    );
    const nextTasks = moveTaskAfter(groupedTasks, taskOrderId, afterTaskId);
    const nextTask = nextTasks.find(t => t.id === task.id || getTaskOrderId(t) === taskOrderId);
    if (!nextTask) return false;

    const oldOrder = oldTasks.map(getTaskOrderId).join('|');
    const nextOrder = nextTasks.map(getTaskOrderId).join('|');
    const orderChanged = oldOrder !== nextOrder;
    const groupPathChanged = serializeGroupPath(task.groupPath) !== serializeGroupPath(nextTask.groupPath);
    const fieldValuesChanged = fieldValueChanges.some(change =>
      (task.projectFieldValues?.[change.fieldId] || '') !== change.value
    );
    if (!orderChanged && !groupPathChanged && !fieldValuesChanged) return true;

    logDashboardEvent('[DashboardTasks] Move task to group started', {
      projectId: selectedProjectId,
      taskId,
      itemId: task.itemId,
      targetGroupPath: groupPath,
      fieldValueChanges,
      afterTaskId,
      orderChanged,
      groupPathChanged,
      fieldValuesChanged,
    });

    setTasks(nextTasks);

    let success = true;
    for (const change of fieldValueChanges) {
      if (!success) break;
      if ((task.projectFieldValues?.[change.fieldId] || '') === change.value) continue;
      const field = projectFields.find(candidate => candidate.id === change.fieldId);
      if (change.value === '') {
        success = await clearProjectV2ItemField(selectedProjectId, task.itemId, change.fieldId, githubToken);
      } else {
        success = await updateProjectV2ItemField(
          selectedProjectId,
          task.itemId,
          change.fieldId,
          getProjectFieldUpdateValue(field, change.value),
          githubToken
        );
      }
    }

    if (success && groupPathChanged) {
      success = await persistTaskGroupPath(nextTask, nextTask.groupPath || []);
    }

    if (success && orderChanged) {
      success = await updateProjectV2ItemPosition(selectedProjectId, task.itemId, afterTaskId, githubToken);
    }

    if (success) {
      logDashboardEvent('[DashboardTasks] Move task to group completed', {
        projectId: selectedProjectId,
        movedItemIds: [task.itemId],
        targetGroupPath: groupPath,
        fieldValueChanges,
        afterTaskId,
      });
      if (orderChanged) {
        markRecentLocalReorder([task.itemId]);
      }
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    logDashboardEvent('[DashboardTasks] Move task to group failed', {
      projectId: selectedProjectId,
      movedItemIds: [task.itemId],
      targetGroupPath: groupPath,
      fieldValueChanges,
      afterTaskId,
      fallbackRefreshKind: (groupPathChanged || fieldValuesChanged) && orderChanged ? 'full_project' : undefined,
    }, 'warn');
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    if ((groupPathChanged || fieldValuesChanged) && orderChanged) {
      await fetchProjectTasks(selectedProjectId, githubToken, { mode: 'background', reason: 'fallback', preserveViewport: true });
    }
    return false;
  }, [selectedProjectId, githubToken, setTasks, projectFields, persistTaskGroupPath, markRecentLocalReorder, updateSyncTime, showToast, t, fetchProjectTasks, tasksRef]);

  return {
    reorderTask,
    reorderTaskBlock,
    moveTaskToGroupPath,
  };
}
