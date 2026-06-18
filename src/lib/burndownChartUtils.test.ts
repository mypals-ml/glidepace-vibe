import { describe, expect, it } from 'vitest';
import { buildBurndownChartData, getTaskEstimateDays } from './burndownChartUtils';
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

describe('burndown chart calculations', () => {
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
    const data = buildBurndownChartData([
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
    expect(data.completionDate).toBe('2026-06-05');
    expect(data.statusTotals).toEqual({ done: 2, inFlight: 0, todo: 3 });
    expect(data.points.find((point) => point.date === '2026-06-02')?.remainingDays).toBe(3);
    expect(data.points.find((point) => point.date === '2026-06-05')?.remainingDays).toBe(3);
  });

  it('counts done effort on the task target date instead of the GitHub close date', () => {
    const data = buildBurndownChartData([
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

  it('spreads open task effort across the next worker load dates', () => {
    const data = buildBurndownChartData([
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
});
