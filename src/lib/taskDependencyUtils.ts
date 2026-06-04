import type { FixedSuccessorStartDateMode, Task } from '../types';
import { calculateStartDate, calculateTargetDate } from './dateUtils';
import { defaultWorkCalendar } from './workCalendar';

interface CascadeTaskDatesOptions {
  fixedStartDateMode?: FixedSuccessorStartDateMode;
  useRealDates?: boolean;
}

export interface DependencyFieldCorrection {
  taskId: string;
  field: 'successor' | 'predecessor';
  ids: string[];
}

function toCascadeOptions(options: boolean | CascadeTaskDatesOptions | undefined): CascadeTaskDatesOptions {
  if (typeof options === 'boolean') {
    return { useRealDates: options, fixedStartDateMode: 'auto' };
  }
  return {
    fixedStartDateMode: options?.fixedStartDateMode || 'ask',
    useRealDates: options?.useRealDates || false,
  };
}

function parseDateValue(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEffectiveTargetDate(task: Task): string {
  return task.tempTargetDate || task.targetDate;
}

function getEffectiveStartDate(task: Task): string {
  return task.tempStartDate || task.startDate;
}

function getTaskKey(task: Task): string {
  return task.itemId || task.id;
}

function preserveUniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function calculateFallbackFloatingStartDate(task: Task): string {
  if (task.targetDate) {
    const estimate = task.estimate !== undefined ? task.estimate : (task.tempEstimate || 1);
    const unit = task.estimateUnit || task.tempEstimateUnit || 'days';
    const fallback = calculateStartDate(task.targetDate, estimate, unit);
    if (fallback) return fallback;
  }

  return defaultWorkCalendar.formatDate(new Date());
}

function calculateFloatingDatesFromPredecessors(tasks: Task[], successor: Task): { startDate: string; targetDate: string } {
  const predecessorIds = successor.predecessorIds || [];
  let latestPredecessorEnd = '';
  let latestPredecessorEndTime = -Infinity;

  for (const predecessorId of predecessorIds) {
    const predecessor = tasks.find(task => getTaskKey(task) === predecessorId || task.id === predecessorId);
    if (!predecessor) continue;

    const predecessorEnd = getEffectiveTargetDate(predecessor);
    const predecessorEndDate = parseDateValue(predecessorEnd);
    if (!predecessorEndDate) continue;

    const predecessorEndTime = predecessorEndDate.getTime();
    if (predecessorEndTime > latestPredecessorEndTime) {
      latestPredecessorEndTime = predecessorEndTime;
      latestPredecessorEnd = predecessorEnd;
    }
  }

  const startDate = latestPredecessorEnd
    ? defaultWorkCalendar.addWorkdays(latestPredecessorEnd, 1)
    : calculateFallbackFloatingStartDate(successor);
  const estimate = successor.estimate !== undefined ? successor.estimate : (successor.tempEstimate || 1);
  const unit = successor.estimateUnit || successor.tempEstimateUnit || 'days';

  return {
    startDate,
    targetDate: calculateTargetDate(startDate, estimate, unit),
  };
}

export function withUpdatedPredecessorIds(task: Task, predecessorIds: string[]): Task {
  return {
    ...task,
    predecessorIds: preserveUniqueIds(predecessorIds),
  };
}

export function autoCorrectDependencyFields(tasks: Task[]): { tasks: Task[]; corrections: DependencyFieldCorrection[] } {
  const tasksCopy = [...tasks];
  const corrections: DependencyFieldCorrection[] = [];
  const findTaskIndex = (taskId: string) => tasksCopy.findIndex(task => getTaskKey(task) === taskId || task.id === taskId);

  const applyCorrection = (taskIndex: number, field: 'successor' | 'predecessor', relatedTaskId: string) => {
    const task = tasksCopy[taskIndex];
    const existingIds = field === 'successor' ? (task.successorIds || []) : (task.predecessorIds || []);
    if (existingIds.includes(relatedTaskId)) return;

    const ids = preserveUniqueIds([...existingIds, relatedTaskId]);
    tasksCopy[taskIndex] = field === 'successor'
      ? { ...task, successorIds: ids }
      : { ...task, predecessorIds: ids };
    corrections.push({
      taskId: getTaskKey(task),
      field,
      ids,
    });
  };

  tasksCopy.forEach(successor => {
    const successorId = getTaskKey(successor);
    (successor.predecessorIds || []).forEach(predecessorId => {
      const predecessorIndex = findTaskIndex(predecessorId);
      if (predecessorIndex !== -1) {
        applyCorrection(predecessorIndex, 'successor', successorId);
      }
    });
  });

  tasksCopy.forEach(predecessor => {
    const predecessorId = getTaskKey(predecessor);
    (predecessor.successorIds || []).forEach(successorId => {
      const successorIndex = findTaskIndex(successorId);
      if (successorIndex !== -1) {
        applyCorrection(successorIndex, 'predecessor', predecessorId);
      }
    });
  });

  return { tasks: tasksCopy, corrections };
}

export function shouldAskToUpdateFixedSuccessorStartDate(predecessor: Task, successor: Task): boolean {
  const predecessorEndDate = parseDateValue(getEffectiveTargetDate(predecessor));
  const successorStartDate = parseDateValue(successor.startDate);

  if (!predecessorEndDate || !successorStartDate) return false;

  return successorStartDate.getTime() < predecessorEndDate.getTime();
}

export function getFixedStartDateUpdateCandidates(tasks: Task[], startTaskId: string, pathSet = new Set<string>()): Task[] {
  const tasksCopy = [...tasks];
  const startTaskIndex = tasksCopy.findIndex(t => t.itemId === startTaskId || t.id === startTaskId);

  if (startTaskIndex === -1) return [];

  const startTask = tasksCopy[startTaskIndex];
  const currentId = (startTask.itemId || startTask.id)!;
  if (pathSet.has(currentId)) return [];
  pathSet.add(currentId);

  const candidates: Task[] = [];
  const predTargetDate = getEffectiveTargetDate(startTask);
  if (!predTargetDate) return candidates;

  for (const successorId of startTask.successorIds || []) {
    const successorIndex = tasksCopy.findIndex(t => t.itemId === successorId || t.id === successorId);
    if (successorIndex === -1) continue;

    const successor = tasksCopy[successorIndex];
    if (successor.startDate) {
      if (shouldAskToUpdateFixedSuccessorStartDate(startTask, successor)) {
        candidates.push(successor);
      }
      continue;
    }

    const newStartDate = defaultWorkCalendar.addWorkdays(predTargetDate, 1);
    const estimate = successor.estimate !== undefined ? successor.estimate : (successor.tempEstimate || 1);
    const unit = successor.estimateUnit || successor.tempEstimateUnit || 'days';
    const updatedSuccessor = {
      ...successor,
      tempStartDate: newStartDate,
      tempTargetDate: calculateTargetDate(newStartDate, estimate, unit),
    };

    tasksCopy[successorIndex] = updatedSuccessor;
    candidates.push(...getFixedStartDateUpdateCandidates(tasksCopy, successorId, new Set(pathSet)));
  }

  return candidates;
}

export function recalculateFloatingSuccessorDates(
  tasks: Task[],
  successorTaskId: string,
  pathSet = new Set<string>(),
  fixedStartDateMode: FixedSuccessorStartDateMode = 'ask'
): Task[] {
  const tasksCopy = [...tasks];
  const successorIndex = tasksCopy.findIndex(task => task.itemId === successorTaskId || task.id === successorTaskId);
  if (successorIndex === -1) return tasks;

  const successor = tasksCopy[successorIndex];
  const successorKey = getTaskKey(successor);
  if (pathSet.has(successorKey)) return tasksCopy;
  pathSet.add(successorKey);

  let updatedSuccessor = successor;
  if (!successor.startDate || (fixedStartDateMode === 'auto' && (successor.predecessorIds || []).length > 0)) {
    const dates = calculateFloatingDatesFromPredecessors(tasksCopy, successor);
    updatedSuccessor = {
      ...successor,
      tempStartDate: dates.startDate,
      tempTargetDate: dates.targetDate,
      localUpdateTimestamp: Date.now(),
    };
    tasksCopy[successorIndex] = updatedSuccessor;
  } else if (successor.tempStartDate || successor.tempTargetDate) {
    updatedSuccessor = { ...successor };
    delete updatedSuccessor.tempStartDate;
    delete updatedSuccessor.tempTargetDate;
    updatedSuccessor.localUpdateTimestamp = Date.now();
    tasksCopy[successorIndex] = updatedSuccessor;
  }

  for (const downstreamId of updatedSuccessor.successorIds || []) {
    const cascadedTasks = recalculateFloatingSuccessorDates(tasksCopy, downstreamId, new Set(pathSet), fixedStartDateMode);
    cascadedTasks.forEach((task, index) => {
      tasksCopy[index] = task;
    });
  }

  return tasksCopy;
}

/**
 * Cascades date changes through the task dependency tree.
 * Uses a path-based visited set to detect and break infinite loops.
 */
export function cascadeTaskDates(
  tasks: Task[],
  startTaskId: string,
  pathSet = new Set<string>(),
  options?: boolean | CascadeTaskDatesOptions
): Task[] {
  const { fixedStartDateMode, useRealDates } = toCascadeOptions(options);
  const tasksCopy = [...tasks];
  const startTaskIndex = tasksCopy.findIndex(t => t.itemId === startTaskId || t.id === startTaskId);
  
  if (startTaskIndex === -1) return tasks;
  const startTask = tasksCopy[startTaskIndex];

  // Loop detection
  const currentId = (startTask.itemId || startTask.id)!;
  if (pathSet.has(currentId)) {
    return tasks;
  }
  pathSet.add(currentId);

  const successors = startTask.successorIds || [];
  if (successors.length === 0) return tasksCopy;

  // Predecessor's effective target date
  const predTargetDate = getEffectiveTargetDate(startTask);
  if (!predTargetDate) return tasksCopy;

  successors.forEach(successorId => {
    const successorIndex = tasksCopy.findIndex(t => t.itemId === successorId || t.id === successorId);
    if (successorIndex === -1) return;

    const successor = tasksCopy[successorIndex];
    
    const isFixedStartDate = Boolean(successor.startDate);
    const shouldUpdate = !isFixedStartDate || fixedStartDateMode === 'auto';
    
    if (shouldUpdate) {
      // Successor starts the workday AFTER predecessor finishes
      const dependencyDates = successor.predecessorIds?.length
        ? calculateFloatingDatesFromPredecessors(tasksCopy, successor)
        : undefined;
      const newStartDate = dependencyDates?.startDate || defaultWorkCalendar.addWorkdays(predTargetDate, 1);
      
      const currentStart = useRealDates ? successor.startDate : getEffectiveStartDate(successor);
      
      if (newStartDate !== currentStart) {
        // Calculate new target date based on estimate
        const estimate = successor.estimate !== undefined ? successor.estimate : (successor.tempEstimate || 1);
        const unit = successor.estimateUnit || successor.tempEstimateUnit || 'days';
        const newTargetDate = dependencyDates?.targetDate || calculateTargetDate(newStartDate, estimate, unit);

        // Update dates
        const updatedSuccessor = { ...successor };
        if (useRealDates && !isFixedStartDate) {
          updatedSuccessor.startDate = newStartDate;
          updatedSuccessor.targetDate = newTargetDate;
          updatedSuccessor.localUpdateTimestamp = Date.now();
          // Clear temp dates so the real ones take precedence in the UI
          delete updatedSuccessor.tempStartDate;
          delete updatedSuccessor.tempTargetDate;
        } else {
          updatedSuccessor.tempStartDate = newStartDate;
          updatedSuccessor.tempTargetDate = newTargetDate;
          updatedSuccessor.localUpdateTimestamp = Date.now();
        }
        
        tasksCopy[successorIndex] = updatedSuccessor;
        
        // Recurse to update this task's successors
        const cascadedTasks = cascadeTaskDates(tasksCopy, successorId, new Set(pathSet), { fixedStartDateMode, useRealDates });
        cascadedTasks.forEach((t, idx) => {
          tasksCopy[idx] = t;
        });
      }
    }
  });

  return tasksCopy;
}

/**
 * Cascades dates for all tasks in the project.
 */
export function cascadeAllTasks(tasks: Task[], options?: boolean | CascadeTaskDatesOptions): Task[] {
  const cascadeOptions = toCascadeOptions(options);
  let result = [...tasks];
  
  // Find roots (tasks with no predecessors)
  const hasPredecessor = new Set<string>();
  
  tasks.forEach(t => {
    (t.successorIds || []).forEach(sid => hasPredecessor.add(sid));
  });
  
  const roots = tasks.filter(t => !hasPredecessor.has(t.itemId!));
  
  roots.forEach(root => {
    result = cascadeTaskDates(result, root.itemId!, new Set(), cascadeOptions);
  });
  
  return result;
}
