import { describe, expect, it } from 'vitest';
import { buildForecastDashboardData, getTaskEstimateDays } from './forecastDashboardUtils';
import type { Task } from '../types';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id || 'task',
  displayId: overrides.displayId || overrides.id || 'task',
  title: overrides.title || overrides.id || 'Task',
  status: overrides.status || 'Todo',
  startDate: overrides.startDate || '2026-06-01',
  targetDate: overrides.targetDate || '2026-06-01',
  assignees: overrides.assignees || [],
  progress: overrides.progress || 0,
  estimate: overrides.estimate,
  estimateUnit: overrides.estimateUnit,
  closedAt: overrides.closedAt,
});

describe('forecast dashboard calculations', () => {
  it('normalizes estimate units into days', () => {
    expect(getTaskEstimateDays(makeTask({ estimate: 16, estimateUnit: 'hours' }))).toBe(2);
    expect(getTaskEstimateDays(makeTask({ estimate: 2, estimateUnit: 'weeks' }))).toBe(10);
    expect(getTaskEstimateDays(makeTask({ estimate: 3, estimateUnit: 'days' }))).toBe(3);
  });

  it('falls back to inclusive task duration when estimate is missing', () => {
    expect(getTaskEstimateDays(makeTask({
      startDate: '2026-06-01',
      targetDate: '2026-06-03',
    }))).toBe(3);
  });

  it('builds actual and projected remaining points', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'done',
        status: 'Done',
        estimate: 2,
        targetDate: '2026-06-02',
        closedAt: '2026-06-04T10:00:00Z',
      }),
      makeTask({
        id: 'open',
        status: 'Todo',
        estimate: 3,
        startDate: '2026-06-03',
        targetDate: '2026-06-05',
      }),
    ], new Date(2026, 5, 3));

    expect(data.totalEstimateDays).toBe(5);
    expect(data.remainingDays).toBe(3);
    // New capacity-based rule for unassigned work (DEFAULT_WORKER treated as capacity-1 worker):
    // 3 days effort from 2026-06-03 requires 3 workdays → lands on a later date after weekend.
    expect(data.completionDate).toBe('2026-06-08');
    expect(data.statusTotals).toEqual({ done: 2, inFlight: 0, todo: 3 });
    expect(data.statusBreakdown).toEqual([
      { status: 'Todo', statusKey: 'todo', days: 3 },
      { status: 'Done', statusKey: 'done', days: 2 },
    ]);
    expect(data.points.find((point) => point.date === '2026-06-02')?.remainingDays).toBe(3);
    // With projected simulation, remaining reaches 0 on the capacity completion date
    expect(data.points.find((point) => point.date === '2026-06-08')?.remainingDays).toBe(0);
    // There should now be future projected points
    const futurePoints = data.points.filter(p => p.future);
    expect(futurePoints.length).toBeGreaterThan(0);
  });

  it('counts done effort on the task target date instead of the GitHub close date', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'done-on-first-day',
        status: 'Done',
        estimate: 1,
        startDate: '2026-05-05',
        targetDate: '2026-05-05',
        closedAt: '2026-05-08T06:11:01Z',
      }),
      makeTask({
        id: 'open-work',
        status: 'Todo',
        estimate: 4,
        startDate: '2026-05-05',
        targetDate: '2026-05-08',
      }),
    ], new Date(2026, 4, 5));

    expect(data.totalEstimateDays).toBe(5);
    expect(data.points[0]).toMatchObject({
      date: '2026-05-05',
      doneDays: 1,
      remainingDays: 4,
    });
  });

  it('does not burn down overdue open tasks as completed historical work', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'overdue-open-work',
        status: 'In progress',
        estimate: 2,
        startDate: '2026-06-01',
        targetDate: '2026-06-01',
      }),
      makeTask({
        id: 'done-work',
        status: 'Done',
        estimate: 3,
        startDate: '2026-06-01',
        targetDate: '2026-06-02',
      }),
    ], new Date(2026, 5, 3));

    expect(data.totalEstimateDays).toBe(5);
    expect(data.remainingDays).toBe(1);
    expect(data.points.find((point) => point.date === '2026-06-01')?.remainingDays).toBe(5);
    expect(data.points.find((point) => point.date === '2026-06-02')?.remainingDays).toBe(2);
    expect(data.points.find((point) => point.date === '2026-06-03')?.remainingDays).toBe(1);
  });

  it('uses the Todo workload assumption for common Todo-equivalent statuses', () => {
    const data = buildForecastDashboardData([
      makeTask({ id: 'to-do', status: 'To do', estimate: 2 }),
      makeTask({ id: 'backlog', status: 'Backlog', estimate: 2 }),
      makeTask({ id: 'not-started', status: 'Not started', estimate: 2 }),
    ], new Date(2026, 5, 1), {
      statusRemainingPercent: {
        todo: 80,
        other: 10,
      },
    });

    expect(data.remainingDays).toBeCloseTo(4.8);
  });

  it('uses available workers to move the capacity-based completion date', () => {
    const task = makeTask({
      id: 'parallel-work',
      status: 'Todo',
      estimate: 10,
      assignees: [{
        id: 'user-1',
        name: 'Ada',
        login: 'ada',
        initials: 'AD',
        avatarColor: '#4f46e5',
      }],
    });

    const oneWorker = buildForecastDashboardData([task], new Date(2026, 5, 1), {
      capacityDaysPerWeek: 5,
      availableWorkers: 1,
    });
    const twoWorkers = buildForecastDashboardData([task], new Date(2026, 5, 1), {
      capacityDaysPerWeek: 5,
      availableWorkers: 2,
    });

    expect(oneWorker.completionDate).toBe('2026-06-15');
    expect(twoWorkers.completionDate).toBe('2026-06-08');
    expect(twoWorkers.points.at(-1)).toMatchObject({
      date: '2026-06-08',
      remainingDays: 0,
    });
  });

  it('excludes draft and done tasks from the zero-remaining completion fallback', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'done-work',
        status: 'Done',
        estimate: 2,
        startDate: '2026-06-10',
        targetDate: '2026-06-10',
      }),
      makeTask({
        id: 'future-draft',
        status: 'Draft',
        estimate: 5,
        startDate: '2026-07-07',
        targetDate: '2026-07-07',
      }),
      makeTask({
        id: 'future-done',
        status: 'Done',
        estimate: 3,
        startDate: '2026-07-10',
        targetDate: '2026-07-10',
      }),
    ], new Date(2026, 5, 27), {
      statusRemainingPercent: {
        draft: 0,
      },
    });

    expect(data.remainingDays).toBe(0);
    expect(data.completionDate).toBe('2026-06-27');
  });

  it('spreads open task effort across the next worker load dates', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'assigned',
        status: 'In progress',
        estimate: 4,
        startDate: '2026-06-01',
        targetDate: '2026-06-04',
        assignees: [{
          id: 'user-1',
          name: 'Ada',
          login: 'ada',
          initials: 'AD',
          avatarColor: '#4f46e5',
        }],
      }),
    ], new Date(2026, 5, 1));

    expect(data.workerLoads[0]?.worker).toBe('Ada');
    expect(data.workerLoads[0]?.days.slice(0, 4).map((day) => day.loadDays)).toEqual([1, 1, 1, 1]);
  });

  it('splits scheduled worker load across every task assignee', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'shared-task',
        status: 'Todo',
        estimate: 4,
        startDate: '2026-06-01',
        targetDate: '2026-06-04',
        assignees: [
          { id: 'user-1', name: 'Ada', login: 'ada', initials: 'AD', avatarColor: '#4f46e5' },
          { id: 'user-2', name: 'Grace', login: 'grace', initials: 'GH', avatarColor: '#0f766e' },
        ],
      }),
    ], new Date(2026, 5, 1));

    expect(data.workerLoads).toHaveLength(2);
    expect(data.workerLoads.map((worker) => worker.totalDays)).toEqual([2, 2]);
    expect(data.workerLoads[0]?.days.slice(0, 4).map((day) => day.loadDays)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('omits worker rows when no scheduled work overlaps the next ten days', () => {
    const data = buildForecastDashboardData([
      makeTask({
        id: 'past-task',
        status: 'Todo',
        estimate: 3,
        startDate: '2026-05-01',
        targetDate: '2026-05-03',
        assignees: [{ id: 'user-1', name: 'Ada', login: 'ada', initials: 'AD', avatarColor: '#4f46e5' }],
      }),
    ], new Date(2026, 5, 1));

    expect(data.workerLoads).toEqual([]);
  });
});
