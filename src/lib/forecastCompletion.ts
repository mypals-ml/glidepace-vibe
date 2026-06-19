// Minimal shape needed for allocation (avoids circular dependency with forecastDashboardUtils)
export interface CompletionTask {
  statusKey: 'done' | 'inFlight' | 'todo';
  status: string;
  estimateDays: number;
  assignees: string[];
}

export const DEFAULT_WORKER = 'Unassigned';

export interface ForecastCompletionAssumptions {
  capacityDaysPerWeek?: number;
  statusRemainingPercent?: Partial<{
    draft: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    other: number;
  }>;
}

const DEFAULT_STATUS_REMAINING_PERCENT = {
  draft: 0,
  todo: 100,
  inProgress: 50,
  inReview: 20,
  done: 0,
  other: 50,
};

function normalizePercent(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

function normalizeDailyCapacity(capacityDaysPerWeek: number | undefined): number {
  if (typeof capacityDaysPerWeek !== 'number' || !Number.isFinite(capacityDaysPerWeek) || capacityDaysPerWeek <= 0) {
    return 1;
  }
  return capacityDaysPerWeek / 5;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
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

export function isWorkday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6; // Mon-Fri
}

/**
 * Advance a date by a number of workdays (Mon-Fri), respecting the 5d/week capacity assumption.
 */
export function addWorkdays(base: Date, workDays: number): Date {
  if (!Number.isFinite(workDays) || workDays <= 0) return new Date(base);
  let d = new Date(base);
  let added = 0;
  while (added < workDays) {
    d = addDays(d, 1);
    if (isWorkday(d)) {
      added += 1;
    }
  }
  return d;
}

/**
 * Returns the remaining workload percentage (as factor 0-1) for a given task status.
 * Used in the forecasting algorithm to scale the effective remaining effort
 * based on how much work is actually left for that status.
 *
 * - Draft: 0%
 * - Todo: 100%
 * - In progress: 50%
 * - In review: 20%
 * - Done: 0%
 * - All other statuses: 50%
 */
export function getStatusRemainingWorkloadFactor(status: string, assumptions: ForecastCompletionAssumptions = {}): number {
  const s = (status || '').toLowerCase();
  const percent = assumptions.statusRemainingPercent ?? {};
  if (s.includes('done') || s.includes('closed')) return normalizePercent(percent.done, DEFAULT_STATUS_REMAINING_PERCENT.done) / 100;
  if (s.includes('draft')) return normalizePercent(percent.draft, DEFAULT_STATUS_REMAINING_PERCENT.draft) / 100;
  if (s.includes('todo')) return normalizePercent(percent.todo, DEFAULT_STATUS_REMAINING_PERCENT.todo) / 100;
  if (s.includes('progress')) return normalizePercent(percent.inProgress, DEFAULT_STATUS_REMAINING_PERCENT.inProgress) / 100;
  if (s.includes('review')) return normalizePercent(percent.inReview, DEFAULT_STATUS_REMAINING_PERCENT.inReview) / 100;
  return normalizePercent(percent.other, DEFAULT_STATUS_REMAINING_PERCENT.other) / 100;
}

/**
 * Allocate remaining effort (person-days) to assignees.
 *
 * Rules (user's proposal + refinements for correctness):
 * - Tasks with assignees: the workload is split equally among the assignees on *that specific task*
 *   (equal split because all assignees currently share the same global capacity assumption).
 *   If capacities per assignee ever become individual, shares would be proportional to capacity.
 * - Tasks without assignees: the workload is spread *fairly and equally* across all *active* (already
 *   assigned) assignees in the project. This updates their personal workloads.
 * - If the project has zero assignees at all, the entire remaining effort is assigned to a single
 *   virtual "Unassigned" worker (representing the team as a whole). This ensures "Workers count" = 1.
 *
 * This produces per-assignee workloads used both for the project completion date and for
 * simulating future daily workload (projected dots).
 */
export function allocateRemainingWork(chartTasks: CompletionTask[], assumptions: ForecastCompletionAssumptions = {}): Map<string, number> {
  const openTasks = chartTasks.filter(t => t.statusKey !== 'done');
  const workByAssignee = new Map<string, number>();
  const activeAssignees = new Set<string>();

  // Pass 1: tasks that have real assignees
  openTasks.forEach(task => {
    const realAssignees = task.assignees.filter(a => a !== DEFAULT_WORKER);
    if (realAssignees.length === 0) return;

    realAssignees.forEach(a => activeAssignees.add(a));

    const factor = getStatusRemainingWorkloadFactor(task.status, assumptions);
    const effort = task.estimateDays * factor;  // scale by status remaining workload %
    const share = effort / realAssignees.length;
    realAssignees.forEach(a => {
      workByAssignee.set(a, (workByAssignee.get(a) || 0) + share);
    });
  });

  // Pass 2: unassigned work — spread fairly to whoever is active
  if (activeAssignees.size > 0) {
    openTasks.forEach(task => {
      const hasReal = task.assignees.some(a => a !== DEFAULT_WORKER);
      if (hasReal) return;

      const factor = getStatusRemainingWorkloadFactor(task.status, assumptions);
      const effort = task.estimateDays * factor;
      const share = effort / activeAssignees.size;
      activeAssignees.forEach(a => {
        workByAssignee.set(a, (workByAssignee.get(a) || 0) + share);
      });
    });
  } else {
    // No assignees in the whole project → treat as 1 virtual worker
    let unassignedTotal = 0;
    openTasks.forEach(task => {
      if (task.assignees.includes(DEFAULT_WORKER) || task.assignees.length === 0) {
        const factor = getStatusRemainingWorkloadFactor(task.status, assumptions);
        unassignedTotal += task.estimateDays * factor;
      }
    });
    if (unassignedTotal > 0) {
      workByAssignee.set(DEFAULT_WORKER, unassignedTotal);
    }
  }

  return workByAssignee;
}

/**
 * Compute per-assignee completion dates + the overall project estimated completion date.
 *
 * Each assignee's workload is turned into a finish date by adding the required workdays
 * (capacity = 1 person-day per workday).
 * The project date is the latest (max) of those dates.
 */
export function computeCapacityBasedCompletion(
  workByAssignee: Map<string, number>,
  today: Date,
  assumptions: ForecastCompletionAssumptions = {}
): { assigneeCompletions: Array<{ assignee: string; work: number; completion: string }>; projectCompletion: string } {
  const assigneeCompletions: Array<{ assignee: string; work: number; completion: string }> = [];
  let latest = toIsoDate(today);
  const dailyCapacity = normalizeDailyCapacity(assumptions.capacityDaysPerWeek);

  workByAssignee.forEach((work, assignee) => {
    if (work <= 0) return;
    const workDays = Math.ceil(work / dailyCapacity);
    const finishDate = addWorkdays(today, workDays);
    const completion = toIsoDate(finishDate);
    assigneeCompletions.push({ assignee, work, completion });
    if (completion > latest) latest = completion;
  });

  if (assigneeCompletions.length === 0) {
    return { assigneeCompletions, projectCompletion: toIsoDate(today) };
  }

  return { assigneeCompletions, projectCompletion: latest };
}

/**
 * Simulate future remaining workload (for the projected dots in the chart).
 *
 * Given the per-assignee allocation and the initial remaining effort,
 * walk forward day-by-day (only burning on workdays) and produce the remaining
 * effort value for each date in the range.
 *
 * This is the core of "projecting ... future dates's workload".
 */
export function simulateFutureRemaining(
  dateRange: string[],
  initialRemaining: number,
  workByAssignee: Map<string, number>,
  assumptions: ForecastCompletionAssumptions = {}
): number[] {
  const remainingAtDate: number[] = [];
  const simWork = new Map<string, number>();
  workByAssignee.forEach((w, a) => simWork.set(a, w));

  let currentRem = initialRemaining;
  const dailyCapacity = normalizeDailyCapacity(assumptions.capacityDaysPerWeek);

  for (const dateStr of dateRange) {
    const d = parseDate(dateStr)!;
    const isWd = isWorkday(d);
    let dayBurn = 0;

    if (isWd && currentRem > 0) {
      simWork.forEach((left, a) => {
        if (left > 0.01) {
          const burn = Math.min(dailyCapacity, left);
          dayBurn += burn;
          simWork.set(a, Math.max(0, left - burn));
        }
      });
    }

    currentRem = Math.max(0, currentRem - dayBurn);
    remainingAtDate.push(currentRem);
  }

  // Ensure last value is exactly 0 when there was work
  if (initialRemaining > 0 && remainingAtDate.length > 0) {
    remainingAtDate[remainingAtDate.length - 1] = 0;
  }

  return remainingAtDate;
}
