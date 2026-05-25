import type { Task } from '../types';

export type BreakLinkScope = 'all' | 'predecessors' | 'successors';

export interface BreakLinkOperation {
  taskId: string;
  successorIds: string[];
}

export interface BreakLinkPlan {
  hasPredecessors: boolean;
  hasSuccessors: boolean;
  operations: BreakLinkOperation[];
}

function getTaskIdentityCandidates(task: Task): string[] {
  return [task.itemId, task.id].filter((value): value is string => Boolean(value));
}

function getTaskMutationId(task: Task): string {
  return task.itemId || task.id;
}

function hasLinkToTask(task: Task, target: Task): boolean {
  const targetIds = new Set(getTaskIdentityCandidates(target));
  return (task.successorIds || []).some(successorId => targetIds.has(successorId));
}

function removeTaskLinks(successorIds: string[] | undefined, target: Task): string[] {
  const targetIds = new Set(getTaskIdentityCandidates(target));
  return (successorIds || []).filter(successorId => !targetIds.has(successorId));
}

export function buildBreakLinkPlan(
  tasks: Task[],
  boundary: { firstTask: Task; lastTask: Task },
  scope: BreakLinkScope,
): BreakLinkPlan {
  const predecessorTasks = tasks.filter(task => hasLinkToTask(task, boundary.firstTask));
  const hasPredecessors = predecessorTasks.length > 0;
  const hasSuccessors = Boolean(boundary.lastTask.successorIds?.length);
  const operations: BreakLinkOperation[] = [];

  if (scope !== 'successors') {
    predecessorTasks.forEach(task => {
      operations.push({
        taskId: getTaskMutationId(task),
        successorIds: removeTaskLinks(task.successorIds, boundary.firstTask),
      });
    });
  }

  if (scope !== 'predecessors' && hasSuccessors) {
    operations.push({
      taskId: getTaskMutationId(boundary.lastTask),
      successorIds: [],
    });
  }

  return {
    hasPredecessors,
    hasSuccessors,
    operations,
  };
}
