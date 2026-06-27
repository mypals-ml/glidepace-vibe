import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProjectV2ItemField } from '../../lib/githubService';
import { getProjectDisplayTitle } from '../../lib/projectDisplay';
import { applyFieldGroupPaths, buildGroupBlocksFromOrderedTasks, renameGroupBlock as renameGroupBlockInTasks, serializeGroupPath, ungroupGroupBlock as ungroupGroupBlockInTasks, isTaskGroupBlock } from '../../lib/taskGroupUtils';
import { getTaskOrderId } from '../../lib/taskOrderUtils';
import type { Task, GitHubProjectV2Field, GroupPath } from '../../types';
import type { DashboardTasksCore } from './types';

interface UseTaskGroupingProps {
  core: DashboardTasksCore;
  filteredTasks: Task[];
  projectFields: GitHubProjectV2Field[];
}

/**
 * Group-block state and mutations: collapse/expand, group-by-field selection,
 * the derived dashboard item tree, and group-path persistence (move, rename,
 * ungroup).
 */
export function useTaskGrouping({ core, filteredTasks, projectFields }: UseTaskGroupingProps) {
  const { t } = useTranslation();
  const { githubToken, selectedProject, dateSettingsRef, tasksRef, setTasks, updateSyncTime, showToast } = core;

  const [collapsedGroupBlockIds, setCollapsedGroupBlockIds] = useState<string[]>([]);
  const [selectedGroupFieldIds, setSelectedGroupFieldIds] = useState<string[]>([]);

  const groupFieldNamesById = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(projectFields.map(field => [field.id, field.name]));
  }, [projectFields]);

  const dashboardItems = useMemo(
    () => buildGroupBlocksFromOrderedTasks(
      applyFieldGroupPaths(filteredTasks, selectedGroupFieldIds, groupFieldNamesById),
      getProjectDisplayTitle(selectedProject?.title, t('dashboard.currentProject', 'Current Project')),
      new Set(collapsedGroupBlockIds)
    ),
    [filteredTasks, selectedGroupFieldIds, groupFieldNamesById, selectedProject?.title, collapsedGroupBlockIds, t]
  );

  const toggleGroupBlockCollapsed = useCallback((groupBlockId: string) => {
    setCollapsedGroupBlockIds(prev =>
      prev.includes(groupBlockId)
        ? prev.filter(id => id !== groupBlockId)
        : [...prev, groupBlockId]
    );
  }, []);

  const selectedProjectId = selectedProject?.id;

  const persistTaskGroupPath = useCallback(async (task: Task, groupPath: GroupPath) => {
    if (!selectedProjectId || !task.itemId || !githubToken) return false;
    const fieldId = dateSettingsRef.current.groupPathFieldId || task.projectFieldIds?.groupPath;
    if (!fieldId) return false;

    return updateProjectV2ItemField(
      selectedProjectId,
      task.itemId,
      fieldId,
      { text: serializeGroupPath(groupPath) },
      githubToken
    );
  }, [githubToken, selectedProjectId, dateSettingsRef]);

  const persistChangedGroupPaths = useCallback(async (oldTasks: Task[], nextTasks: Task[]) => {
    const oldTasksById = new Map(
      oldTasks.flatMap(task => {
        const entries: Array<[string, Task]> = [[task.id, task]];
        if (task.itemId) entries.push([task.itemId, task]);
        return entries;
      })
    );
    const changedTasks = nextTasks.filter((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasksById.get(getTaskOrderId(task))?.groupPath || oldTasks[index]?.groupPath)
    );

    for (const task of changedTasks) {
      const success = await persistTaskGroupPath(task, task.groupPath || []);
      if (!success) return false;
    }

    return true;
  }, [persistTaskGroupPath]);

  const updateTaskGroupPath = useCallback(async (taskId: string, groupPath: GroupPath): Promise<boolean> => {
    const oldTasks = [...tasksRef.current];
    const task = oldTasks.find(t => t.id === taskId || t.itemId === taskId);
    if (!task) return false;

    const nextTasks = oldTasks.map(t =>
      (t.id === task.id || t.itemId === task.itemId)
        ? { ...t, groupPath: [...groupPath], localUpdateTimestamp: Date.now() }
        : t
    );

    setTasks(nextTasks);
    const success = await persistTaskGroupPath(task, groupPath);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [persistTaskGroupPath, setTasks, showToast, t, updateSyncTime, tasksRef]);

  const renameGroupBlock = useCallback(async (groupBlockId: string, name: string): Promise<boolean> => {
    const groupBlock = dashboardItems.find(item => isTaskGroupBlock(item) && item.groupBlockId === groupBlockId);
    if (!groupBlock || !isTaskGroupBlock(groupBlock)) return false;
    if (!groupBlock || groupBlock.isSyntheticRoot) return false;

    const oldTasks = [...tasksRef.current];
    const renamedTasks = renameGroupBlockInTasks(oldTasks, groupBlock, name);
    const timestamp = Date.now();
    const nextTasks = renamedTasks.map((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasks[index]?.groupPath)
        ? { ...task, localUpdateTimestamp: timestamp }
        : task
    );

    setTasks(nextTasks);
    const success = await persistChangedGroupPaths(oldTasks, nextTasks);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [dashboardItems, persistChangedGroupPaths, setTasks, showToast, t, updateSyncTime, tasksRef]);

  const ungroupGroupBlock = useCallback(async (groupBlockId: string): Promise<boolean> => {
    const groupBlock = dashboardItems.find(item => isTaskGroupBlock(item) && item.groupBlockId === groupBlockId);
    if (!groupBlock || !isTaskGroupBlock(groupBlock)) return false;
    if (!groupBlock || groupBlock.isSyntheticRoot) return false;

    const oldTasks = [...tasksRef.current];
    const ungroupedTasks = ungroupGroupBlockInTasks(oldTasks, groupBlock);
    const timestamp = Date.now();
    const nextTasks = ungroupedTasks.map((task, index) =>
      serializeGroupPath(task.groupPath) !== serializeGroupPath(oldTasks[index]?.groupPath)
        ? { ...task, localUpdateTimestamp: timestamp }
        : task
    );

    setTasks(nextTasks);
    const success = await persistChangedGroupPaths(oldTasks, nextTasks);
    if (success) {
      updateSyncTime();
      return true;
    }

    setTasks(oldTasks);
    showToast(t('dashboard.groupPathUpdateFailed', 'Failed to update task group.'), 'error');
    return false;
  }, [dashboardItems, persistChangedGroupPaths, setTasks, showToast, t, updateSyncTime, tasksRef]);

  return {
    collapsedGroupBlockIds,
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
    dashboardItems,
    toggleGroupBlockCollapsed,
    persistTaskGroupPath,
    persistChangedGroupPaths,
    updateTaskGroupPath,
    renameGroupBlock,
    ungroupGroupBlock,
  };
}
