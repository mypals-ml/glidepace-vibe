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
export function cascadeTaskDates(tasks: Task[], startTaskId: string, pathSet = new Set<string>()): Task[] {
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
    
    // Only update temp dates if the successor doesn't have its own hard-set start date
    if (!successor.startDate) {
      // Successor starts the workday AFTER predecessor finishes
      const newStartDate = addWorkdays(predTargetDate, 1);
      
      if (newStartDate !== successor.tempStartDate) {
        // Update temp dates
        const updatedSuccessor = { ...successor, tempStartDate: newStartDate };
        
        // Calculate new temp target date based on estimate
        const estimate = successor.estimate !== undefined ? successor.estimate : (successor.tempEstimate || 1);
        const unit = successor.estimateUnit || successor.tempEstimateUnit || 'days';
        
        // Workday-aware target date calculation
        // For simplicity, we use the existing calculateTargetDate but we'll need to make it workday-aware eventually
        // For now, let's at least ensure the cascade continues
        const newTargetDate = calculateTargetDate(newStartDate, estimate, unit);
        updatedSuccessor.tempTargetDate = newTargetDate;
        
        tasksCopy[successorIndex] = updatedSuccessor;

        // Recursive cascade to this successor's own children
        const recursiveResult = cascadeTaskDates(tasksCopy, successorId, new Set(pathSet));
        // Update our copy with results from recursion
        recursiveResult.forEach(updatedTask => {
          const idx = tasksCopy.findIndex(t => t.id === updatedTask.id);
          if (idx !== -1) tasksCopy[idx] = updatedTask;
        });
      }
    }
  });

  return tasksCopy;
}

/**
 * Runs a full cascade pass across the entire project.
 * Useful for initial loads and manual syncs.
 */
export function cascadeAllTasks(tasks: Task[]): Task[] {
  let currentTasks = [...tasks];
  
  // Find "root" tasks (those without predecessors) to start the cascade
  // Or just iterate and cascade from each task (loop detection handles efficiency)
  tasks.forEach(task => {
    currentTasks = cascadeTaskDates(currentTasks, (task.itemId || task.id)!);
  });
  
  return currentTasks;
}
