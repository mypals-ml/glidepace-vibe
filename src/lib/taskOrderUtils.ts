import type { Task, TaskInsertPosition } from '../types';

export function getTaskOrderId(task: Pick<Task, 'id' | 'itemId'>): string {
  return task.itemId || task.id;
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
