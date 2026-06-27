import type { Task } from '../types';
import {
  allocateRemainingWork as allocateForCompletion,
  computeCapacityBasedCompletion as computeCapacityCompletion,
  simulateFutureRemaining,
  getStatusRemainingWorkloadFactor,
  type ForecastCompletionAssumptions,
} from './forecastCompletion';

export type ForecastStatusKey = 'done' | 'inFlight' | 'todo';

export interface ForecastTaskPoint {
  id: string;
  displayId: string;
  title: string;
  status: string;
  statusKey: ForecastStatusKey;
  estimateDays: number;
  startDate: string;
  targetDate: string;
  doneDate?: string;
  assignees: string[];
}

export interface ForecastPoint {
  date: string;
  doneDays: number;
  remainingDays: number;
  future: boolean;
}

export interface ForecastWorkerDay {
  date: string;
  loadDays: number;
}

export interface ForecastWorkerLoad {
  worker: string;
  totalDays: number;
  days: ForecastWorkerDay[];
}

export interface ForecastStatusTotal {
  status: string;
  statusKey: ForecastStatusKey;
  days: number;
}

export interface ForecastDashboardData {
  taskCount: number;
  totalEstimateDays: number;
  remainingDays: number;
  completionDate: string;
  statusTotals: Record<ForecastStatusKey, number>;
  statusBreakdown: ForecastStatusTotal[];
  points: ForecastPoint[];
  workerLoads: ForecastWorkerLoad[];
  tasks: ForecastTaskPoint[];
}

export interface ForecastDashboardAssumptions extends ForecastCompletionAssumptions {
  startDate?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WORKER = 'Unassigned';

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function normalizeDate(value: string | undefined, fallback: string): string {
  return parseDate(value) ? value!.slice(0, 10) : fallback;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffCalendarDays(startDate: string, targetDate: string): number {
  const start = parseDate(startDate);
  const target = parseDate(targetDate);
  if (!start || !target) return 1;
  return Math.max(1, Math.round((target.getTime() - start.getTime()) / DAY_MS) + 1);
}

function eachDate(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toIsoDate(cursor));
  }
  return dates;
}

function maxDate(values: string[]): string {
  return values.reduce((latest, value) => value > latest ? value : latest, values[0]);
}

function minDate(values: string[]): string {
  return values.reduce((earliest, value) => value < earliest ? value : earliest, values[0]);
}

function isFallbackCompletionTask(task: Pick<ForecastTaskPoint, 'status' | 'statusKey'>): boolean {
  return task.statusKey !== 'done' && !task.status.toLowerCase().includes('draft');
}

export function getForecastStatusKey(task: Pick<Task, 'status' | 'progress'>): ForecastStatusKey {
  const status = task.status.toLowerCase();
  if (status.includes('done') || status.includes('closed') || task.progress >= 100) {
    return 'done';
  }
  if (status.includes('progress') || status.includes('review') || task.progress > 0) {
    return 'inFlight';
  }
  return 'todo';
}

export function getTaskEstimateDays(task: Pick<Task, 'estimate' | 'estimateUnit' | 'startDate' | 'targetDate' | 'tempStartDate' | 'tempTargetDate'>): number {
  if (Number.isFinite(task.estimate) && task.estimate && task.estimate > 0) {
    const unit = (task.estimateUnit || '').toLowerCase();
    if (unit.includes('hour')) return Math.max(0.1, task.estimate / 8);
    if (unit.includes('week')) return task.estimate * 5;
    if (unit.includes('month')) return task.estimate * 20;
    return task.estimate;
  }

  const startDate = task.tempStartDate || task.startDate;
  const targetDate = task.tempTargetDate || task.targetDate || startDate;
  return diffCalendarDays(startDate, targetDate);
}

export function buildForecastDashboardData(tasks: Task[], today = new Date(), assumptions: ForecastDashboardAssumptions = {}): ForecastDashboardData {
  const todayIso = toIsoDate(today);
  const assumedStartDate = parseDate(assumptions.startDate) ? assumptions.startDate!.slice(0, 10) : undefined;
  const chartTasks: ForecastTaskPoint[] = tasks.map((task) => {
    const statusKey = getForecastStatusKey(task);
    const startDate = normalizeDate(task.tempStartDate || task.startDate, todayIso);
    const targetDate = normalizeDate(task.tempTargetDate || task.targetDate, startDate);
    const doneDate = statusKey === 'done' ? targetDate : undefined;

    const estimateDays = getTaskEstimateDays(task);
    return {
      id: task.id,
      displayId: task.displayId,
      title: task.title,
      status: task.status || 'Todo',
      statusKey,
      estimateDays,
      startDate,
      targetDate,
      doneDate,
      assignees: task.assignees.length ? task.assignees.map((assignee) => assignee.name || assignee.login || DEFAULT_WORKER) : [DEFAULT_WORKER],
    };
  });

  const totalEstimateDays = chartTasks.reduce((sum, task) => sum + task.estimateDays, 0);
  const statusTotals = chartTasks.reduce<Record<ForecastStatusKey, number>>((totals, task) => {
    totals[task.statusKey] += task.estimateDays;
    return totals;
  }, { done: 0, inFlight: 0, todo: 0 });
  // Use status-based remaining workload % for forecasting (and effective remaining)
  const remainingDays = chartTasks
    .filter(task => task.statusKey !== 'done')
    .reduce((sum, task) => sum + task.estimateDays * getStatusRemainingWorkloadFactor(task.status, assumptions), 0);
  const statusBreakdown = [...chartTasks.reduce<Map<string, ForecastStatusTotal>>((totals, task) => {
    const existing = totals.get(task.status) || { status: task.status, statusKey: task.statusKey, days: 0 };
    existing.days += task.estimateDays;
    totals.set(task.status, existing);
    return totals;
  }, new Map()).values()].sort((left, right) => right.days - left.days || left.status.localeCompare(right.status));

  const dateValues = chartTasks.flatMap((task) => [task.startDate, task.targetDate, task.doneDate].filter(Boolean) as string[]);
  const fallbackDateValues = chartTasks
    .filter(isFallbackCompletionTask)
    .flatMap((task) => [task.startDate, task.targetDate, task.doneDate].filter(Boolean) as string[]);
  const fallbackStart = todayIso;
  const dateBasedStart = dateValues.length ? minDate([...dateValues, todayIso]) : fallbackStart;

  // Capacity-based estimated completion + future workload projection (encapsulated in forecastCompletion.ts)
  const workByAssignee = allocateForCompletion(chartTasks, assumptions);
  const { projectCompletion: capacityCompletion } = computeCapacityCompletion(workByAssignee, today, assumptions);

  // date range start prefers historical dates; end uses capacity-derived when there is remaining work
  const startDate = assumedStartDate ?? dateBasedStart;
  const hasRemainingWork = remainingDays > 0.01;
  const calculatedCompletionDate = hasRemainingWork && capacityCompletion > todayIso
    ? capacityCompletion
    : (fallbackDateValues.length ? maxDate([...fallbackDateValues, todayIso]) : todayIso);
  const completionDate = maxDate([calculatedCompletionDate, startDate]);

  const dateRange = eachDate(startDate, completionDate);

  // Build skeleton
  let points: ForecastPoint[] = dateRange.map((date) => ({
    date,
    doneDays: 0,
    remainingDays: 0,
    future: date > todayIso,
  }));

  // Fill ACTUAL points (dates <= today) using task target/done dates
  points = points.map((p) => {
    if (p.future) return p;

    const doneDays = chartTasks.reduce((sum, task) => {
      if (task.statusKey === 'done') {
        return task.doneDate && task.doneDate <= p.date ? sum + task.estimateDays : sum;
      }
      if (task.targetDate <= p.date) {
        return sum + task.estimateDays;
      }
      return sum;
    }, 0);

    return {
      ...p,
      doneDays: Math.min(totalEstimateDays, doneDays),
      remainingDays: Math.max(0, totalEstimateDays - doneDays),
    };
  });

  // Fill PROJECTED points — delegated to the encapsulated algorithm
  const projStartIdx = points.findIndex((p) => p.future);
  if (projStartIdx !== -1 && hasRemainingWork) {
    const futureDates = dateRange.slice(projStartIdx);
    const projectedRems = simulateFutureRemaining(
      futureDates,
      remainingDays,
      workByAssignee,
      assumptions
    );

    for (let i = 0; i < projectedRems.length; i++) {
      const idx = projStartIdx + i;
      const rem = projectedRems[i];
      points[idx] = {
        ...points[idx],
        doneDays: Math.min(totalEstimateDays, totalEstimateDays - rem),
        remainingDays: rem,
      };
    }

    // Guarantee final point is zero
    const lastIdx = points.length - 1;
    points[lastIdx] = {
      ...points[lastIdx],
      doneDays: totalEstimateDays,
      remainingDays: 0,
    };
  } else if (projStartIdx !== -1) {
    for (let i = projStartIdx; i < points.length; i++) {
      points[i] = { ...points[i], doneDays: totalEstimateDays, remainingDays: 0 };
    }
  }

  const workerWindow = eachDate(todayIso, toIsoDate(addDays(today, 9)));
  const workerMap = new Map<string, number[]>();
  chartTasks.filter((task) => task.statusKey !== 'done').forEach((task) => {
    const taskDates = eachDate(task.startDate, task.targetDate);
    const dailyLoad = task.estimateDays / Math.max(1, taskDates.length);
    task.assignees.forEach((worker) => {
      const loads = workerMap.get(worker) || Array(workerWindow.length).fill(0);
      workerWindow.forEach((date, index) => {
        if (taskDates.includes(date)) loads[index] += dailyLoad;
      });
      workerMap.set(worker, loads);
    });
  });

  const workerLoads = [...workerMap.entries()]
    .map(([worker, loads]) => ({
      worker,
      totalDays: loads.reduce((sum, load) => sum + load, 0),
      days: workerWindow.map((date, index) => ({ date, loadDays: loads[index] })),
    }))
    .sort((left, right) => right.totalDays - left.totalDays)
    .slice(0, 5);

  return {
    taskCount: chartTasks.length,
    totalEstimateDays,
    remainingDays,
    completionDate,
    statusTotals,
    statusBreakdown,
    points,
    workerLoads,
    tasks: chartTasks,
  };
}
