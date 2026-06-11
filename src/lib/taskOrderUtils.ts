import type { DashboardItem, GroupPath, Task, TaskGroupBlock, TaskInsertPosition } from '../types';
import { isTaskGroupBlock } from './taskGroupUtils';

export type DashboardItemSortId = `task:${string}` | `group:${string}`;

export interface DashboardItemMovePlan {
  taskIds: string[];
  afterTaskId: string | null;
}

export interface DashboardGroupDropPlan {
  taskId: string;
  targetGroupPath: GroupPath;
  afterTaskId: string | null;
}

export function getTaskOrderId(task: Pick<Task, 'id' | 'itemId'>): string {
  return task.itemId || task.id;
}

export function getTaskSortId(task: Pick<Task, 'id' | 'itemId'>): DashboardItemSortId {
  return `task:${getTaskOrderId(task)}`;
}

export function getGroupSortId(group: Pick<TaskGroupBlock, 'groupBlockId'>): DashboardItemSortId {
  return `group:${group.groupBlockId}`;
}

export function getDashboardItemSortId(item: DashboardItem): DashboardItemSortId {
  return isTaskGroupBlock(item) ? getGroupSortId(item) : getTaskSortId(item);
}

export function moveTaskAfter(tasks: Task[], taskId: string, afterTaskId: string | null): Task[] {
  const currentIndex = tasks.findIndex(task => getTaskOrderId(task) === taskId || task.id === taskId);
  if (currentIndex === -1) return tasks;

  const task = tasks[currentIndex];
  const remainingTasks = tasks.filter((_, index) => index !== currentIndex);

  if (afterTaskId === null) {
    return [task, ...remainingTasks];
  }

  const insertAfterIndex = remainingTasks.findIndex(
    candidate => getTaskOrderId(candidate) === afterTaskId || candidate.id === afterTaskId
  );
  if (insertAfterIndex === -1) return tasks;

  return [
    ...remainingTasks.slice(0, insertAfterIndex + 1),
    task,
    ...remainingTasks.slice(insertAfterIndex + 1),
  ];
}

export function upsertTaskAfter(tasks: Task[], taskToUpsert: Task, afterTaskId: string | null): Task[] {
  const taskId = getTaskOrderId(taskToUpsert);
  const currentIndex = tasks.findIndex(task => getTaskOrderId(task) === taskId || task.id === taskId);
  const remainingTasks = currentIndex === -1
    ? tasks
    : tasks.filter((_, index) => index !== currentIndex);
  const nextTask = currentIndex === -1 ? taskToUpsert : { ...tasks[currentIndex], ...taskToUpsert };

  if (afterTaskId === null) {
    return [nextTask, ...remainingTasks];
  }

  const insertAfterIndex = remainingTasks.findIndex(
    candidate => getTaskOrderId(candidate) === afterTaskId || candidate.id === afterTaskId
  );
  if (insertAfterIndex === -1) {
    return currentIndex === -1 ? [...remainingTasks, nextTask] : tasks;
  }

  return [
    ...remainingTasks.slice(0, insertAfterIndex + 1),
    nextTask,
    ...remainingTasks.slice(insertAfterIndex + 1),
  ];
}

export function moveTaskBlockAfter(tasks: Task[], taskIds: string[], afterTaskId: string | null): Task[] {
  const movingTaskIdSet = new Set(taskIds);
  if (movingTaskIdSet.size === 0) return tasks;
  if (afterTaskId !== null && movingTaskIdSet.has(afterTaskId)) return tasks;

  const movingTasks = tasks.filter(task => movingTaskIdSet.has(getTaskOrderId(task)) || movingTaskIdSet.has(task.id));
  if (movingTasks.length === 0) return tasks;

  const remainingTasks = tasks.filter(task => !movingTaskIdSet.has(getTaskOrderId(task)) && !movingTaskIdSet.has(task.id));

  if (afterTaskId === null) {
    return [...movingTasks, ...remainingTasks];
  }

  const insertAfterIndex = remainingTasks.findIndex(
    candidate => getTaskOrderId(candidate) === afterTaskId || candidate.id === afterTaskId
  );
  if (insertAfterIndex === -1) return tasks;

  return [
    ...remainingTasks.slice(0, insertAfterIndex + 1),
    ...movingTasks,
    ...remainingTasks.slice(insertAfterIndex + 1),
  ];
}

export function getAfterIdForVisibleMove(visibleTasks: Task[], activeTaskId: string, overTaskId: string): string | null | undefined {
  const activeIndex = visibleTasks.findIndex(task => getTaskOrderId(task) === activeTaskId || task.id === activeTaskId);
  const overIndex = visibleTasks.findIndex(task => getTaskOrderId(task) === overTaskId || task.id === overTaskId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return undefined;

  const nextVisibleTasks = [...visibleTasks];
  const [activeTask] = nextVisibleTasks.splice(activeIndex, 1);
  nextVisibleTasks.splice(overIndex, 0, activeTask);

  const nextActiveIndex = nextVisibleTasks.findIndex(task => getTaskOrderId(task) === activeTaskId || task.id === activeTaskId);
  const previousVisibleTask = nextActiveIndex > 0 ? nextVisibleTasks[nextActiveIndex - 1] : null;
  return previousVisibleTask ? getTaskOrderId(previousVisibleTask) : null;
}

export function getAfterIdForInsertPosition(tasks: Task[], insertPosition: TaskInsertPosition): string | null {
  const targetIndex = tasks.findIndex(
    task => getTaskOrderId(task) === insertPosition.targetTaskId || task.id === insertPosition.targetTaskId
  );
  if (targetIndex === -1) return null;

  if (insertPosition.placement === 'below') {
    return getTaskOrderId(tasks[targetIndex]);
  }

  const previousTask = targetIndex > 0 ? tasks[targetIndex - 1] : null;
  return previousTask ? getTaskOrderId(previousTask) : null;
}

export function getAfterIdForAppend(tasks: Task[]): string | null {
  const lastTask = tasks[tasks.length - 1];
  return lastTask ? getTaskOrderId(lastTask) : null;
}

function getDashboardItemTaskIds(item: DashboardItem): string[] {
  return isTaskGroupBlock(item) ? item.childTaskIds : [getTaskOrderId(item)];
}

function isSyntheticRootGroup(item: DashboardItem): boolean {
  return isTaskGroupBlock(item) && Boolean(item.isSyntheticRoot);
}

function getDashboardItemBySortId(items: DashboardItem[], sortId: string, includeSyntheticRoot = false): DashboardItem | undefined {
  return items.find(item => (includeSyntheticRoot || !isSyntheticRootGroup(item)) && getDashboardItemSortId(item) === sortId);
}

interface PreviousAnchorScan {
  afterTaskId: string | null;
  crossedGroupStart: boolean;
}

/**
 * Walks upward from the simulated drop position to find the task the moved
 * item should be placed after.
 *
 * - A task row is a direct "place after this task" anchor.
 * - A collapsed group row, or the group header the item was dropped onto,
 *   represents its whole child block, so the anchor is its last child task.
 * - An expanded group header only marks the visible beginning of that group:
 *   crossing it means the item was dropped at the top of the group, so the
 *   scan continues above the header and reports `crossedGroupStart`.
 */
function scanPreviousAnchor(
  items: DashboardItem[],
  activeIndex: number,
  movingTaskIdSet: Set<string>,
  overSortId: string
): PreviousAnchorScan {
  let crossedGroupStart = false;

  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const candidate = items[index];

    if (isTaskGroupBlock(candidate)) {
      const representsWholeBlock = !candidate.isExpanded || getDashboardItemSortId(candidate) === overSortId;
      if (!representsWholeBlock) {
        crossedGroupStart = true;
        continue;
      }

      for (let taskIndex = candidate.childTaskIds.length - 1; taskIndex >= 0; taskIndex -= 1) {
        const taskId = candidate.childTaskIds[taskIndex];
        if (!movingTaskIdSet.has(taskId)) return { afterTaskId: taskId, crossedGroupStart };
      }
      continue;
    }

    const taskId = getTaskOrderId(candidate);
    if (!movingTaskIdSet.has(taskId)) return { afterTaskId: taskId, crossedGroupStart };
  }

  return { afterTaskId: null, crossedGroupStart: true };
}

/**
 * Finds the first non-moving task below the simulated drop position. When an
 * item lands at the beginning of a group this is the group's original first
 * task, which the moved item should become the closest upper neighbor of.
 */
function getNextAnchorTaskId(
  items: DashboardItem[],
  activeIndex: number,
  movingTaskIdSet: Set<string>
): string | null {
  for (let index = activeIndex + 1; index < items.length; index += 1) {
    const candidate = items[index];

    if (isTaskGroupBlock(candidate)) {
      if (candidate.isExpanded) continue;

      const firstChildTaskId = candidate.childTaskIds.find(taskId => !movingTaskIdSet.has(taskId));
      if (firstChildTaskId) return firstChildTaskId;
      continue;
    }

    const taskId = getTaskOrderId(candidate);
    if (!movingTaskIdSet.has(taskId)) return taskId;
  }

  return null;
}

/**
 * Returns the closest non-moving task that precedes `taskId` in the
 * underlying ordered task list. Placing a moved item after that predecessor
 * makes it the exact upper neighbor of `taskId`, which stays correct even
 * when the visible list is re-sorted (e.g. by "Group by Fields") or filtered.
 */
function getUnderlyingPredecessorTaskId(
  orderedTasks: ReadonlyArray<Pick<Task, 'id' | 'itemId'>>,
  taskId: string,
  movingTaskIdSet: Set<string>
): string | null {
  const taskIndex = orderedTasks.findIndex(task => getTaskOrderId(task) === taskId || task.id === taskId);
  if (taskIndex === -1) return null;

  for (let index = taskIndex - 1; index >= 0; index -= 1) {
    const candidate = orderedTasks[index];
    const candidateTaskId = getTaskOrderId(candidate);
    if (!movingTaskIdSet.has(candidateTaskId) && !movingTaskIdSet.has(candidate.id)) return candidateTaskId;
  }

  return null;
}

export function getVisibleDashboardMovePlan(
  dashboardItems: DashboardItem[],
  activeSortId: string,
  overSortId: string,
  orderedTasks?: ReadonlyArray<Pick<Task, 'id' | 'itemId'>>
): DashboardItemMovePlan | undefined {
  if (activeSortId === overSortId) return undefined;

  const activeItem = getDashboardItemBySortId(dashboardItems, activeSortId);
  const overItem = getDashboardItemBySortId(dashboardItems, overSortId);
  if (!activeItem || !overItem) return undefined;

  const movingTaskIds = getDashboardItemTaskIds(activeItem);
  const movingTaskIdSet = new Set(movingTaskIds);
  if (movingTaskIds.length === 0) return undefined;

  const overTaskIds = getDashboardItemTaskIds(overItem);
  if (overTaskIds.every(taskId => movingTaskIdSet.has(taskId))) return undefined;

  const sortableItems = dashboardItems.filter(item => {
    if (isSyntheticRootGroup(item)) return false;
    if (!isTaskGroupBlock(activeItem)) return true;
    if (getDashboardItemSortId(item) === activeSortId) return true;

    const taskIds = getDashboardItemTaskIds(item);
    return taskIds.length === 0 || !taskIds.every(taskId => movingTaskIdSet.has(taskId));
  });

  const activeIndex = sortableItems.findIndex(item => getDashboardItemSortId(item) === activeSortId);
  const overIndex = sortableItems.findIndex(item => getDashboardItemSortId(item) === overSortId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return undefined;

  const nextItems = [...sortableItems];
  const [active] = nextItems.splice(activeIndex, 1);
  nextItems.splice(overIndex, 0, active);

  const nextActiveIndex = nextItems.findIndex(item => getDashboardItemSortId(item) === activeSortId);
  if (nextActiveIndex === -1) return undefined;

  const previousAnchor = scanPreviousAnchor(nextItems, nextActiveIndex, movingTaskIdSet, overSortId);
  let afterTaskId = previousAnchor.afterTaskId;

  if (previousAnchor.crossedGroupStart && orderedTasks && orderedTasks.length > 0) {
    // The item was dropped at the visible beginning of a group: anchor it as
    // the closest upper neighbor of the group's current first task using the
    // underlying order so the placement survives field-group re-sorting.
    const nextAnchorTaskId = getNextAnchorTaskId(nextItems, nextActiveIndex, movingTaskIdSet);
    if (nextAnchorTaskId) {
      afterTaskId = getUnderlyingPredecessorTaskId(orderedTasks, nextAnchorTaskId, movingTaskIdSet);
    }
  }

  return {
    taskIds: movingTaskIds,
    afterTaskId,
  };
}

export function getDashboardGroupDropPlan(
  dashboardItems: DashboardItem[],
  activeSortId: string,
  overSortId: string
): DashboardGroupDropPlan | undefined {
  const activeItem = getDashboardItemBySortId(dashboardItems, activeSortId);
  const overItem = getDashboardItemBySortId(dashboardItems, overSortId, true);
  if (!activeItem || !overItem || isTaskGroupBlock(activeItem) || !isTaskGroupBlock(overItem)) return undefined;

  const taskId = getTaskOrderId(activeItem);
  const targetChildTaskIds = overItem.childTaskIds.filter(childTaskId => (
    childTaskId !== taskId && childTaskId !== activeItem.id
  ));

  return {
    taskId,
    targetGroupPath: [...overItem.path],
    afterTaskId: targetChildTaskIds[targetChildTaskIds.length - 1] ?? null,
  };
}

export function getDashboardTaskGroupPathMovePlan(
  dashboardItems: DashboardItem[],
  activeSortId: string,
  overSortId: string,
  orderedTasks?: ReadonlyArray<Pick<Task, 'id' | 'itemId'>>
): DashboardGroupDropPlan | undefined {
  const activeItem = getDashboardItemBySortId(dashboardItems, activeSortId);
  const overItem = getDashboardItemBySortId(dashboardItems, overSortId);
  if (!activeItem || !overItem || isTaskGroupBlock(activeItem) || isTaskGroupBlock(overItem)) return undefined;

  const activePath = activeItem.groupPath || [];
  const overPath = overItem.groupPath || [];
  if (JSON.stringify(activePath) === JSON.stringify(overPath)) return undefined;

  const movePlan = getVisibleDashboardMovePlan(dashboardItems, activeSortId, overSortId, orderedTasks);
  if (!movePlan || movePlan.taskIds.length !== 1) return undefined;

  return {
    taskId: movePlan.taskIds[0],
    targetGroupPath: [...overPath],
    afterTaskId: movePlan.afterTaskId,
  };
}

export function getGroupPathForCreatedTaskTarget(targetItem: DashboardItem): GroupPath {
  if (!isTaskGroupBlock(targetItem)) return [...(targetItem.groupPath || [])];
  if (targetItem.isSyntheticRoot) return [];
  return targetItem.path.slice(0, -1);
}
