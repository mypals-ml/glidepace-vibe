// ========================================
// Pure task reconciliation utilities.
//
// These functions apply fetched GitHub data (a single project item or a full
// project snapshot) onto the current task array while:
// - protecting recent local edits (mergeFetchedTaskWithLocalState),
// - re-running dependency auto-correction and date cascades,
// - preserving object identity for tasks whose data did not change, so that
//   memoized rows skip rerendering during background refreshes.
// ========================================

import type { FixedSuccessorStartDateMode, Task } from '../types';
import { mergeFetchedTaskWithLocalState } from './taskMergeUtils';
import {
  autoCorrectDependencyFields,
  cascadeAllTasks,
  cascadeTaskDates,
} from './taskDependencyUtils';
import type { DependencyFieldCorrection } from './taskDependencyUtils';

export function getTaskStableId(task: Task): string {
  return task.itemId || task.contentId || task.id;
}

export interface ReconcileTaskOptions {
  fixedStartDateMode: FixedSuccessorStartDateMode;
  /**
   * When the fetched task is not present in the current list: insert it at
   * the end (true) or leave the list untouched and report `needsFullRefresh`
   * (false). Webhook flows should use false because GitHub does not provide
   * the new item's position; the creation flow uses true because it
   * repositions the task itself afterwards.
   */
  insertMissing?: boolean;
  now?: number;
}

export interface SingleTaskReconciliationResult {
  tasks: Task[];
  corrections: DependencyFieldCorrection[];
  changedTaskIds: string[];
  needsFullRefresh: boolean;
}

export interface ProjectSnapshotReconciliationResult {
  tasks: Task[];
  corrections: DependencyFieldCorrection[];
  addedTaskIds: string[];
  removedTaskIds: string[];
  updatedTaskIds: string[];
  movedTaskIds: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Structural equality for task data (primitives, arrays, plain objects).
 * Tasks are plain serializable data, so a recursive comparison is safe.
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEquals(value, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).filter(key => a[key] !== undefined);
    const bKeys = Object.keys(b).filter(key => b[key] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEquals(a[key], b[key]));
  }

  return false;
}

/**
 * Replaces structurally-unchanged tasks in `nextTasks` with their previous
 * object references. If nothing changed at all (same order, same data), the
 * previous array itself is returned so React state consumers can bail out.
 */
function preserveTaskIdentities(previousTasks: Task[], nextTasks: Task[]): Task[] {
  const previousByStableId = new Map(previousTasks.map(task => [getTaskStableId(task), task]));

  const preserved = nextTasks.map(nextTask => {
    const previous = previousByStableId.get(getTaskStableId(nextTask));
    return previous && deepEquals(previous, nextTask) ? previous : nextTask;
  });

  const isIdenticalList = preserved.length === previousTasks.length
    && preserved.every((task, index) => task === previousTasks[index]);

  return isIdenticalList ? previousTasks : preserved;
}

function findTaskIndex(tasks: Task[], fetchedTask: Task): number {
  return tasks.findIndex(task =>
    (task.itemId !== undefined && task.itemId === fetchedTask.itemId)
    || (task.contentId !== undefined && fetchedTask.contentId !== undefined && task.contentId === fetchedTask.contentId)
  );
}

function collectChangedTaskIds(previousTasks: Task[], nextTasks: Task[]): string[] {
  const previousByStableId = new Map(previousTasks.map(task => [getTaskStableId(task), task]));
  return nextTasks
    .filter(task => previousByStableId.get(getTaskStableId(task)) !== task)
    .map(getTaskStableId);
}

/**
 * Applies one fetched project item onto the current task list.
 * Unrelated tasks keep their object references; dependency cascades run from
 * the changed task only, so successor display dates may legitimately update.
 */
export function reconcileSingleTask(
  currentTasks: Task[],
  fetchedTask: Task,
  options: ReconcileTaskOptions
): SingleTaskReconciliationResult {
  const index = findTaskIndex(currentTasks, fetchedTask);

  if (index === -1 && !options.insertMissing) {
    return {
      tasks: currentTasks,
      corrections: [],
      changedTaskIds: [],
      needsFullRefresh: true,
    };
  }

  const mergedTasks = index === -1
    ? [...currentTasks, fetchedTask]
    : currentTasks.map((task, taskIndex) =>
        taskIndex === index ? mergeFetchedTaskWithLocalState(task, fetchedTask, options.now) : task
      );

  const dependencyRepair = autoCorrectDependencyFields(mergedTasks);
  const cascadedTasks = cascadeTaskDates(
    dependencyRepair.tasks,
    fetchedTask.itemId || fetchedTask.id,
    new Set(),
    { fixedStartDateMode: options.fixedStartDateMode }
  );

  const tasks = preserveTaskIdentities(currentTasks, cascadedTasks);

  return {
    tasks,
    corrections: dependencyRepair.corrections,
    changedTaskIds: tasks === currentTasks ? [] : collectChangedTaskIds(currentTasks, tasks),
    needsFullRefresh: false,
  };
}

/**
 * Applies a full ordered GitHub snapshot onto the current task list.
 * The snapshot is authoritative for membership and order; recent local edits
 * are protected per task, and unchanged tasks keep their object references.
 */
export function reconcileProjectSnapshot(
  currentTasks: Task[],
  fetchedTasks: Task[],
  options: Omit<ReconcileTaskOptions, 'insertMissing'>
): ProjectSnapshotReconciliationResult {
  const existingByStableId = new Map(currentTasks.map(task => [task.itemId || task.id, task]));

  const mergedTasks = fetchedTasks.map(fetched => {
    const existing = existingByStableId.get(fetched.itemId || fetched.id);
    return existing ? mergeFetchedTaskWithLocalState(existing, fetched, options.now) : fetched;
  });

  const dependencyRepair = autoCorrectDependencyFields(mergedTasks);
  const cascadedTasks = cascadeAllTasks(dependencyRepair.tasks, {
    fixedStartDateMode: options.fixedStartDateMode,
  });

  const tasks = preserveTaskIdentities(currentTasks, cascadedTasks);

  // Diff sets for debug logging and tests.
  const previousIds = currentTasks.map(getTaskStableId);
  const previousIdSet = new Set(previousIds);
  const nextIds = tasks.map(getTaskStableId);
  const nextIdSet = new Set(nextIds);

  const addedTaskIds = nextIds.filter(id => !previousIdSet.has(id));
  const removedTaskIds = previousIds.filter(id => !nextIdSet.has(id));
  const updatedTaskIds = tasks === currentTasks
    ? []
    : collectChangedTaskIds(currentTasks, tasks).filter(id => previousIdSet.has(id));

  const commonPreviousOrder = previousIds.filter(id => nextIdSet.has(id));
  const commonNextOrder = nextIds.filter(id => previousIdSet.has(id));
  const movedTaskIds = commonNextOrder.filter((id, index) => commonPreviousOrder[index] !== id);

  return {
    tasks,
    corrections: dependencyRepair.corrections,
    addedTaskIds,
    removedTaskIds,
    updatedTaskIds,
    movedTaskIds,
  };
}
