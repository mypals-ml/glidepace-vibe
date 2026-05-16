import { describe, it, expect } from 'vitest';
import { calculateTargetDate, shiftDateByDays } from './dateUtils';
import { cascadeTaskDates } from './taskDependencyUtils';
import type { Task } from '../types';

describe('Date Utilities Math Logic', () => {
  it('calculateTargetDate adds duration correctly', () => {
    expect(calculateTargetDate('2026-03-21', 5)).toBe('2026-03-25');
  });

  it('shiftDateByDays shifts dates correctly', () => {
    expect(shiftDateByDays('2026-03-21', 10)).toBe('2026-03-31');
    expect(shiftDateByDays('2026-03-21', -5)).toBe('2026-03-16');
  });
});

describe('Task dependency cascade logic', () => {
  const makeTask = (overrides: Partial<Task>): Task => ({
    id: overrides.id || 'task',
    itemId: overrides.itemId || overrides.id || 'task',
    displayId: overrides.displayId || overrides.id || 'task',
    title: overrides.title || overrides.id || 'task',
    startDate: overrides.startDate || '2026-03-23',
    targetDate: overrides.targetDate || '2026-03-23',
    status: overrides.status || 'Todo',
    assignees: overrides.assignees || [],
    progress: overrides.progress || 0,
    estimate: overrides.estimate ?? 1,
    estimateUnit: overrides.estimateUnit || 'days',
    autoUpdateStartDate: overrides.autoUpdateStartDate || 'auto',
    successorIds: overrides.successorIds,
    localUpdateTimestamp: overrides.localUpdateTimestamp,
  });

  it('keeps a shifted middle task stable when it becomes the predecessor of another task', () => {
    const afterFirstLink = cascadeTaskDates([
      makeTask({ id: 'A', itemId: 'A', startDate: '2026-03-23', targetDate: '2026-03-23', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', startDate: '2026-03-23', targetDate: '2026-03-23' }),
      makeTask({ id: 'C', itemId: 'C', startDate: '2026-03-23', targetDate: '2026-03-23' }),
    ], 'A', new Set(), true);

    expect(afterFirstLink.find(t => t.id === 'B')?.startDate).toBe('2026-03-24');

    const withSecondLink = afterFirstLink.map(task => (
      task.id === 'B' ? { ...task, successorIds: ['C'] } : task
    ));
    const afterSecondLink = cascadeTaskDates(withSecondLink, 'B', new Set(), true);

    expect(afterSecondLink.find(t => t.id === 'B')?.startDate).toBe('2026-03-24');
    expect(afterSecondLink.find(t => t.id === 'C')?.startDate).toBe('2026-03-25');
  });
});
