import type { Task } from '../types';
import { calculateTargetDate, formatToGitHubDate } from './dateUtils';

/**
 * Checks if a date is a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

/**
 * Adds workdays to a date, skipping weekends.
 */
export function addWorkdays(startDateStr: string, days: number): string {
  if (!startDateStr) return '';
  if (days === 0) return startDateStr;

  const date = new Date(startDateStr);
  const remainingDays = days;
  const direction = days > 0 ? 1 : -1;
  const absRemaining = Math.abs(remainingDays);

  let count = 0;
  while (count < absRemaining) {
    date.setDate(date.getDate() + direction);
    if (!isWeekend(date)) {
      count++;
    }
  }

  return formatToGitHubDate(date);
}

/**
 * Calculates the number of workdays between two dates (inclusive).
 */
export function diffWorkdays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Cascades date changes through the task dependency tree.
 * Uses a path-based visited set to detect and break infinite loops.
 */
export function cascadeTaskDates(tasks: Task[], startTaskId: string, pathSet = new Set<string>(), useRealDates = false): Task[] {
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
  const predTargetDate = startTask.targetDate || startTask.tempTargetDate;
  if (!predTargetDate) return tasksCopy;

  successors.forEach(successorId => {
    const successorIndex = tasksCopy.findIndex(t => t.itemId === successorId || t.id === successorId);
    if (successorIndex === -1) return;

    const successor = tasksCopy[successorIndex];
    
    // Determine if we should update the start date based on the mode
    const mode = successor.autoUpdateStartDate || 'ask';
    const shouldUpdate = mode === 'auto' || (mode === 'ask' && !successor.startDate);
    
    if (shouldUpdate) {
      // Successor starts the workday AFTER predecessor finishes
      const newStartDate = addWorkdays(predTargetDate, 1);
      
      const currentStart = useRealDates ? successor.startDate : successor.tempStartDate;
      
      if (newStartDate !== currentStart) {
        // Calculate new target date based on estimate
        const estimate = successor.estimate !== undefined ? successor.estimate : (successor.tempEstimate || 1);
        const unit = successor.estimateUnit || successor.tempEstimateUnit || 'days';
        const newTargetDate = calculateTargetDate(newStartDate, estimate, unit);

        // Update dates
        const updatedSuccessor = { ...successor };
        if (useRealDates) {
          updatedSuccessor.startDate = newStartDate;
          updatedSuccessor.targetDate = newTargetDate;
        } else {
          updatedSuccessor.tempStartDate = newStartDate;
          updatedSuccessor.tempTargetDate = newTargetDate;
        }
        
        tasksCopy[successorIndex] = updatedSuccessor;
        
        // Recurse to update this task's successors
        const cascadedTasks = cascadeTaskDates(tasksCopy, successorId, new Set(pathSet), useRealDates);
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
export function cascadeAllTasks(tasks: Task[], useRealDates = false): Task[] {
  let result = [...tasks];
  
  // Find roots (tasks with no predecessors)
  const hasPredecessor = new Set<string>();
  
  tasks.forEach(t => {
    (t.successorIds || []).forEach(sid => hasPredecessor.add(sid));
  });
  
  const roots = tasks.filter(t => !hasPredecessor.has(t.itemId!));
  
  roots.forEach(root => {
    result = cascadeTaskDates(result, root.itemId!, new Set(), useRealDates);
  });
  
  return result;
}
