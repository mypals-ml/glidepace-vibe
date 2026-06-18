import type { Task } from '../types';

export type BurndownStatusKey = 'done' | 'inFlight' | 'todo';

export interface BurndownTaskPoint {
  id: string;
  displayId: string;
  title: string;
  statusKey: BurndownStatusKey;
  estimateDays: number;
  startDate: string;
  targetDate: string;
  doneDate?: string;
  assignees: string[];
}

export interface BurndownPoint {
  date: string;
  doneDays: number;
  remainingDays: number;
  future: boolean;
}

export interface BurndownWorkerDay {
  date: string;
  loadDays: number;
}

export interface BurndownWorkerLoad {
  worker: string;
  totalDays: number;
  days: BurndownWorkerDay[];
}

export interface BurndownChartData {
  taskCount: number;
  totalEstimateDays: number;
  remainingDays: number;
  completionDate: string;
  statusTotals: Record<BurndownStatusKey, number>;
  points: BurndownPoint[];
  workerLoads: BurndownWorkerLoad[];
  tasks: BurndownTaskPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WORKER = 'Unassigned';

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

export function getBurndownStatusKey(task: Pick<Task, 'status' | 'progress'>): BurndownStatusKey {
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

export function buildBurndownChartData(tasks: Task[], today = new Date()): BurndownChartData {
  const todayIso = toIsoDate(today);
  const chartTasks: BurndownTaskPoint[] = tasks.map((task) => {
    const statusKey = getBurndownStatusKey(task);
    const startDate = normalizeDate(task.tempStartDate || task.startDate, todayIso);
    const targetDate = normalizeDate(task.tempTargetDate || task.targetDate, startDate);
    const doneDate = statusKey === 'done' ? (task.closedAt?.slice(0, 10) || targetDate) : undefined;

    return {
      id: task.id,
      displayId: task.displayId,
      title: task.title,
      statusKey,
      estimateDays: getTaskEstimateDays(task),
      startDate,
      targetDate,
      doneDate,
      assignees: task.assignees.length ? task.assignees.map((assignee) => assignee.name || assignee.login || DEFAULT_WORKER) : [DEFAULT_WORKER],
    };
  });

  const totalEstimateDays = chartTasks.reduce((sum, task) => sum + task.estimateDays, 0);
  const statusTotals = chartTasks.reduce<Record<BurndownStatusKey, number>>((totals, task) => {
    totals[task.statusKey] += task.estimateDays;
    return totals;
  }, { done: 0, inFlight: 0, todo: 0 });
  const remainingDays = statusTotals.inFlight + statusTotals.todo;

  const dateValues = chartTasks.flatMap((task) => [task.startDate, task.targetDate, task.doneDate].filter(Boolean) as string[]);
  const fallbackStart = todayIso;
  const startDate = dateValues.length ? minDate([...dateValues, todayIso]) : fallbackStart;
  const openTargets = chartTasks.filter((task) => task.statusKey !== 'done').map((task) => task.targetDate);
  const completionDate = openTargets.length ? maxDate([...openTargets, todayIso]) : (dateValues.length ? maxDate([...dateValues, todayIso]) : todayIso);
  const dateRange = eachDate(startDate, completionDate);

  const points = dateRange.map((date) => {
    const doneDays = chartTasks.reduce((sum, task) => {
      if (task.statusKey === 'done') {
        return task.doneDate && task.doneDate <= date ? sum + task.estimateDays : sum;
      }
      if (date > todayIso && task.targetDate <= date) {
        return sum + task.estimateDays;
      }
      return sum;
    }, 0);

    return {
      date,
      doneDays: Math.min(totalEstimateDays, doneDays),
      remainingDays: Math.max(0, totalEstimateDays - doneDays),
      future: date > todayIso,
    };
  });

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
    points,
    workerLoads,
    tasks: chartTasks,
  };
}
