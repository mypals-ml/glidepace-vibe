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

function getPreviousAfterTaskId(items: DashboardItem[], activeIndex: number, movingTaskIdSet: Set<string>): string | null {
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const candidateTaskIds = getDashboardItemTaskIds(items[index]);
    for (let taskIndex = candidateTaskIds.length - 1; taskIndex >= 0; taskIndex -= 1) {
      const taskId = candidateTaskIds[taskIndex];
      if (!movingTaskIdSet.has(taskId)) return taskId;
    }
  }

  return null;
}

export function getVisibleDashboardMovePlan(
  dashboardItems: DashboardItem[],
  activeSortId: string,
  overSortId: string
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

  return {
    taskIds: movingTaskIds,
    afterTaskId: getPreviousAfterTaskId(nextItems, nextActiveIndex, movingTaskIdSet),
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
  overSortId: string
): DashboardGroupDropPlan | undefined {
  const activeItem = getDashboardItemBySortId(dashboardItems, activeSortId);
  const overItem = getDashboardItemBySortId(dashboardItems, overSortId);
  if (!activeItem || !overItem || isTaskGroupBlock(activeItem) || isTaskGroupBlock(overItem)) return undefined;

  const activePath = activeItem.groupPath || [];
  const overPath = overItem.groupPath || [];
  if (JSON.stringify(activePath) === JSON.stringify(overPath)) return undefined;

  const movePlan = getVisibleDashboardMovePlan(dashboardItems, activeSortId, overSortId);
  if (!movePlan || movePlan.taskIds.length !== 1) return undefined;

  return {
    taskId: movePlan.taskIds[0],
    targetGroupPath: [...overPath],
    afterTaskId: movePlan.afterTaskId,
  };
}
