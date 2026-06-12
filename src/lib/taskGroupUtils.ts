import type { DashboardItem, GroupPath, Task, TaskGroupBlock } from '../types';
import { getStartDateForCal, getTargetDateForCal } from './githubTaskMapper';

export const DEFAULT_PROJECT_GROUP_NAME = 'Project';

export function parseGroupPath(value: string | undefined): GroupPath {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((segment): segment is string => typeof segment === 'string')
      .map(segment => segment.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function serializeGroupPath(path: GroupPath | undefined): string {
  return JSON.stringify((path || []).map(segment => segment.trim()).filter(Boolean));
}

export function parseSlashGroupPath(value: string | undefined): GroupPath {
  if (!value) return [];
  return value
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);
}

export function serializeSlashGroupPath(path: GroupPath | undefined): string {
  return (path || []).map(segment => segment.trim()).filter(Boolean).join(' / ');
}

export function groupPathKey(path: GroupPath): string {
  return JSON.stringify(path);
}

export function isTaskGroupBlock(item: DashboardItem): item is TaskGroupBlock {
  return item.kind === 'group';
}

export function isDashboardTask(item: DashboardItem): item is Task {
  return item.kind !== 'group';
}

export function isPathPrefix(prefix: GroupPath, path: GroupPath): boolean {
  if (prefix.length > path.length) return false;
  return prefix.every((segment, index) => segment === path[index]);
}

function commonPrefixLength(a: GroupPath, b: GroupPath): number {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return limit;
}

function getTaskIdentity(task: Pick<Task, 'id' | 'itemId'>): string {
  return task.itemId || task.id;
}

function getDateRange(tasks: Task[], startTaskIndex: number, endTaskIndex: number): { startDate: string; targetDate: string } {
  let startDate = '';
  let targetDate = '';

  for (let i = startTaskIndex; i <= endTaskIndex; i += 1) {
    const task = tasks[i];
    if (!task) continue;

    const taskStart = getStartDateForCal(task);
    const taskTarget = getTargetDateForCal(task);

    if (taskStart && (!startDate || taskStart < startDate)) {
      startDate = taskStart;
    }

    if (taskTarget && (!targetDate || taskTarget > targetDate)) {
      targetDate = taskTarget;
    }
  }

  return { startDate, targetDate };
}

function createGroupBlock(path: GroupPath, startTaskIndex: number, collapsedGroupBlockIds: Set<string>, isSyntheticRoot = false): TaskGroupBlock {
  const groupBlockId = isSyntheticRoot
    ? 'project-root'
    : `${groupPathKey(path)}:${startTaskIndex}:${path.length}`;

  return {
    kind: 'group',
    groupBlockId,
    name: path[path.length - 1] || DEFAULT_PROJECT_GROUP_NAME,
    path,
    depth: path.length,
    startTaskIndex,
    endTaskIndex: startTaskIndex,
    startDate: '',
    targetDate: '',
    childTaskIds: [],
    isExpanded: !collapsedGroupBlockIds.has(groupBlockId),
    isSyntheticRoot,
  };
}

export function calculateGroupBlockDates(tasks: Task[], startTaskIndex: number, endTaskIndex: number): { startDate: string; targetDate: string } {
  if (tasks.length === 0 || startTaskIndex < 0 || endTaskIndex < startTaskIndex) {
    return { startDate: '', targetDate: '' };
  }

  return getDateRange(tasks, startTaskIndex, endTaskIndex);
}

export function buildGroupBlocksFromOrderedTasks(
  tasks: Task[],
  projectName: string,
  collapsedGroupBlockIds: Set<string> = new Set()
): DashboardItem[] {
  const projectGroup = createGroupBlock([], 0, collapsedGroupBlockIds, true);
  projectGroup.name = projectName || DEFAULT_PROJECT_GROUP_NAME;
  projectGroup.depth = 0;
  projectGroup.isExpanded = !collapsedGroupBlockIds.has(projectGroup.groupBlockId);

  const items: DashboardItem[] = [projectGroup];
  if (tasks.length === 0) return items;

  const openGroups: TaskGroupBlock[] = [projectGroup];
  let previousPath: GroupPath = [];

  const closeGroupsToDepth = (depth: number, endTaskIndex: number) => {
    while (openGroups.length - 1 > depth) {
      const group = openGroups.pop();
      if (!group) continue;
      group.endTaskIndex = endTaskIndex;
      const range = calculateGroupBlockDates(tasks, group.startTaskIndex, group.endTaskIndex);
      group.startDate = range.startDate;
      group.targetDate = range.targetDate;
      group.childTaskIds = tasks
        .slice(group.startTaskIndex, group.endTaskIndex + 1)
        .filter(task => isPathPrefix(group.path, task.groupPath || []))
        .map(getTaskIdentity);
    }
  };

  tasks.forEach((task, taskIndex) => {
    const currentPath = task.groupPath || [];
    const commonLength = commonPrefixLength(previousPath, currentPath);
    closeGroupsToDepth(commonLength, taskIndex - 1);

    for (let depth = commonLength; depth < currentPath.length; depth += 1) {
      const path = currentPath.slice(0, depth + 1);
      const group = createGroupBlock(path, taskIndex, collapsedGroupBlockIds);
      const hasCollapsedAncestor = openGroups.some(openGroup => !openGroup.isExpanded);
      openGroups.push(group);
      if (!hasCollapsedAncestor) {
        items.push(group);
      }
    }

    const hasCollapsedAncestor = openGroups.some(openGroup => !openGroup.isExpanded);
    if (!hasCollapsedAncestor) {
      items.push({
        ...task,
        kind: 'task',
        depth: currentPath.length + 1,
      });
    }

    previousPath = currentPath;
  });

  closeGroupsToDepth(0, tasks.length - 1);
  projectGroup.endTaskIndex = tasks.length - 1;
  projectGroup.childTaskIds = tasks.map(getTaskIdentity);
  const projectRange = calculateGroupBlockDates(tasks, 0, tasks.length - 1);
  projectGroup.startDate = projectRange.startDate;
  projectGroup.targetDate = projectRange.targetDate;

  return items;
}

export function renameGroupBlock(tasks: Task[], groupBlock: TaskGroupBlock, newName: string): Task[] {
  const trimmedName = newName.trim();
  if (!trimmedName || groupBlock.isSyntheticRoot || groupBlock.path.length === 0) return tasks;

  const segmentIndex = groupBlock.path.length - 1;
  const childTaskIds = new Set(groupBlock.childTaskIds);
  return tasks.map((task, index) => {
    const taskId = getTaskIdentity(task);
    if (!childTaskIds.has(taskId) && (index < groupBlock.startTaskIndex || index > groupBlock.endTaskIndex)) return task;
    const groupPath = task.groupPath || [];
    if (!isPathPrefix(groupBlock.path, groupPath)) return task;

    const nextPath = [...groupPath];
    nextPath[segmentIndex] = trimmedName;
    return { ...task, groupPath: nextPath };
  });
}

export function ungroupGroupBlock(tasks: Task[], groupBlock: TaskGroupBlock): Task[] {
  if (groupBlock.isSyntheticRoot || groupBlock.path.length === 0) return tasks;

  const segmentIndex = groupBlock.path.length - 1;
  const childTaskIds = new Set(groupBlock.childTaskIds);
  return tasks.map((task, index) => {
    const taskId = getTaskIdentity(task);
    if (!childTaskIds.has(taskId) && (index < groupBlock.startTaskIndex || index > groupBlock.endTaskIndex)) return task;
    const groupPath = task.groupPath || [];
    if (!isPathPrefix(groupBlock.path, groupPath)) return task;

    return {
      ...task,
      groupPath: groupPath.filter((_, pathIndex) => pathIndex !== segmentIndex),
    };
  });
}

export function moveTasksToGroupPath(tasks: Task[], taskIds: string[], targetPath: GroupPath): Task[] {
  const taskIdSet = new Set(taskIds);
  return tasks.map(task => {
    if (!taskIdSet.has(getTaskIdentity(task)) && !taskIdSet.has(task.id)) return task;
    return { ...task, groupPath: [...targetPath] };
  });
}

function normalizeFieldGroupSegment(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed || 'No value';
}

function buildFieldGroupSegment(fieldName: string | undefined, value: string | undefined): string {
  const normalizedValue = normalizeFieldGroupSegment(value);
  const trimmedFieldName = fieldName?.trim();
  return trimmedFieldName ? `${trimmedFieldName}: ${normalizedValue}` : normalizedValue;
}

export function applyFieldGroupPaths(
  tasks: Task[],
  fieldIds: string[],
  fieldNamesById: Record<string, string> = {}
): Task[] {
  const selectedFieldIds = fieldIds.map(fieldId => fieldId.trim()).filter(Boolean);
  if (selectedFieldIds.length === 0) return tasks;

  const decoratedTasks = tasks.map((task, index) => {
    const fieldSegments = selectedFieldIds.map(fieldId =>
      buildFieldGroupSegment(fieldNamesById[fieldId], task.projectFieldValues?.[fieldId])
    );
    return {
      index,
      task: {
        ...task,
        groupPath: [...fieldSegments, ...(task.groupPath || [])],
      },
      key: fieldSegments.map(segment => segment.toLocaleLowerCase()).join('\u0000'),
    };
  });

  return decoratedTasks
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index)
    .map(({ task }) => task);
}
