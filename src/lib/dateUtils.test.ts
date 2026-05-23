import { describe, it, expect } from 'vitest';
import { calculateTargetDate, shiftDateByDays } from './dateUtils';
import { autoCorrectDependencyFields, cascadeTaskDates, recalculateFloatingSuccessorDates, shouldAskToUpdateFixedSuccessorStartDate } from './taskDependencyUtils';
import { defaultWorkCalendar, formatWorkCalendarDate, getCurrentTimeZone } from './workCalendar';
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

describe('Default work calendar', () => {
  it('reports a local time zone', () => {
    expect(getCurrentTimeZone()).toBeTruthy();
    expect(defaultWorkCalendar.timeZone).toBeTruthy();
  });

  it('formats Date objects using the local work calendar date', () => {
    expect(formatWorkCalendarDate(new Date(2026, 4, 24, 0, 30))).toBe('2026-05-24');
  });

  it('treats Monday through Friday as workdays', () => {
    expect(defaultWorkCalendar.isWorkday('2026-03-23')).toBe(true);
    expect(defaultWorkCalendar.isWorkday('2026-03-24')).toBe(true);
    expect(defaultWorkCalendar.isWorkday('2026-03-25')).toBe(true);
    expect(defaultWorkCalendar.isWorkday('2026-03-26')).toBe(true);
    expect(defaultWorkCalendar.isWorkday('2026-03-27')).toBe(true);
  });

  it('treats Saturday and Sunday as non-workdays', () => {
    expect(defaultWorkCalendar.isNonWorkday('2026-03-28')).toBe(true);
    expect(defaultWorkCalendar.isNonWorkday('2026-03-29')).toBe(true);
  });

  it('adds workdays while skipping weekends', () => {
    expect(defaultWorkCalendar.addWorkdays('2026-03-27', 1)).toBe('2026-03-30');
  });

  it('counts workdays while excluding weekends', () => {
    expect(defaultWorkCalendar.diffWorkdays('2026-03-27', '2026-03-30')).toBe(2);
  });
});

describe('Task dependency cascade logic', () => {
  const makeTask = (overrides: Partial<Task>): Task => ({
    id: overrides.id || 'task',
    itemId: overrides.itemId || overrides.id || 'task',
    displayId: overrides.displayId || overrides.id || 'task',
    title: overrides.title || overrides.id || 'task',
    startDate: overrides.startDate ?? '2026-03-23',
    targetDate: overrides.targetDate ?? '2026-03-23',
    tempStartDate: overrides.tempStartDate,
    tempTargetDate: overrides.tempTargetDate,
    status: overrides.status || 'Todo',
    assignees: overrides.assignees || [],
    progress: overrides.progress || 0,
    estimate: overrides.estimate ?? 1,
    estimateUnit: overrides.estimateUnit || 'days',
    autoUpdateStartDate: overrides.autoUpdateStartDate || 'auto',
    successorIds: overrides.successorIds,
    predecessorIds: overrides.predecessorIds,
    localUpdateTimestamp: overrides.localUpdateTimestamp,
  });

  it('updates floating successors through temp dates without writing real dates', () => {
    const afterFirstLink = cascadeTaskDates([
      makeTask({ id: 'A', itemId: 'A', startDate: '2026-03-23', targetDate: '2026-03-23', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', startDate: '', targetDate: '' }),
    ], 'A', new Set(), { fixedStartDateMode: 'ask' });

    const successor = afterFirstLink.find(t => t.id === 'B');
    expect(successor?.startDate).toBe('');
    expect(successor?.targetDate).toBe('');
    expect(successor?.tempStartDate).toBe('2026-03-24');
    expect(successor?.tempTargetDate).toBe('2026-03-24');
  });

  it('keeps fixed successor real dates unchanged when fixed starts are not auto moved', () => {
    const afterLink = cascadeTaskDates([
      makeTask({ id: 'A', itemId: 'A', startDate: '2026-03-23', targetDate: '2026-03-25', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', startDate: '2026-03-23', targetDate: '2026-03-23' }),
    ], 'A', new Set(), { fixedStartDateMode: 'ask' });

    const successor = afterLink.find(t => t.id === 'B');
    expect(successor?.startDate).toBe('2026-03-23');
    expect(successor?.targetDate).toBe('2026-03-23');
    expect(successor?.tempStartDate).toBeUndefined();
    expect(successor?.tempTargetDate).toBeUndefined();
  });

  it('moves fixed successors through temp dates when fixed starts are auto moved', () => {
    const afterLink = cascadeTaskDates([
      makeTask({ id: 'A', itemId: 'A', startDate: '2026-03-23', targetDate: '2026-03-25', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', startDate: '2026-03-23', targetDate: '2026-03-23' }),
    ], 'A', new Set(), { fixedStartDateMode: 'auto' });

    const successor = afterLink.find(t => t.id === 'B');
    expect(successor?.startDate).toBe('2026-03-23');
    expect(successor?.targetDate).toBe('2026-03-23');
    expect(successor?.tempStartDate).toBe('2026-03-26');
    expect(successor?.tempTargetDate).toBe('2026-03-26');
  });

  it('cascades changed predecessor dates through floating successors', () => {
    const afterFirstLink = cascadeTaskDates([
      makeTask({ id: 'A', itemId: 'A', startDate: '2026-03-23', targetDate: '2026-03-23', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', startDate: '', targetDate: '' }),
      makeTask({ id: 'C', itemId: 'C', startDate: '2026-03-23', targetDate: '2026-03-23' }),
    ], 'A', new Set(), { fixedStartDateMode: 'auto' });

    expect(afterFirstLink.find(t => t.id === 'B')?.tempStartDate).toBe('2026-03-24');

    const withSecondLink = afterFirstLink.map(task => (
      task.id === 'B' ? { ...task, successorIds: ['C'] } : task
    ));
    const afterSecondLink = cascadeTaskDates(withSecondLink, 'B', new Set(), { fixedStartDateMode: 'auto' });

    expect(afterSecondLink.find(t => t.id === 'B')?.tempStartDate).toBe('2026-03-24');
    expect(afterSecondLink.find(t => t.id === 'C')?.startDate).toBe('2026-03-23');
    expect(afterSecondLink.find(t => t.id === 'C')?.tempStartDate).toBe('2026-03-25');
  });

  it('asks only when a fixed successor starts before its predecessor ends', () => {
    const predecessor = makeTask({ id: 'A', targetDate: '2026-03-25' });

    expect(shouldAskToUpdateFixedSuccessorStartDate(
      predecessor,
      makeTask({ id: 'B', startDate: '2026-03-24' })
    )).toBe(true);
    expect(shouldAskToUpdateFixedSuccessorStartDate(
      predecessor,
      makeTask({ id: 'B', startDate: '2026-03-25' })
    )).toBe(false);
    expect(shouldAskToUpdateFixedSuccessorStartDate(
      predecessor,
      makeTask({ id: 'B', startDate: '' })
    )).toBe(false);
    expect(shouldAskToUpdateFixedSuccessorStartDate(
      makeTask({ id: 'A', targetDate: '' }),
      makeTask({ id: 'B', startDate: '2026-03-24' })
    )).toBe(false);
  });

  it('recalculates an unlinked floating successor from its remaining predecessors', () => {
    const result = recalculateFloatingSuccessorDates([
      makeTask({ id: 'A', itemId: 'A', targetDate: '2026-03-25' }),
      makeTask({ id: 'C', itemId: 'C', targetDate: '2026-03-27' }),
      makeTask({
        id: 'B',
        itemId: 'B',
        startDate: '',
        targetDate: '',
        tempStartDate: '2026-03-26',
        tempTargetDate: '2026-03-26',
        predecessorIds: ['C'],
      }),
    ], 'B');

    const successor = result.find(t => t.id === 'B');
    expect(successor?.tempStartDate).toBe('2026-03-30');
    expect(successor?.tempTargetDate).toBe('2026-03-30');
    expect(successor?.startDate).toBe('');
  });

  it('auto-corrects missing successor links when walking upstream from predecessors', () => {
    const { tasks, corrections } = autoCorrectDependencyFields([
      makeTask({ id: 'A', itemId: 'A', successorIds: [] }),
      makeTask({ id: 'B', itemId: 'B', predecessorIds: ['A'] }),
    ]);

    expect(tasks.find(t => t.id === 'A')?.successorIds).toEqual(['B']);
    expect(corrections).toEqual([
      { taskId: 'A', field: 'successor', ids: ['B'] },
    ]);
  });

  it('auto-corrects missing predecessor links when walking downstream from successors', () => {
    const { tasks, corrections } = autoCorrectDependencyFields([
      makeTask({ id: 'A', itemId: 'A', successorIds: ['B'] }),
      makeTask({ id: 'B', itemId: 'B', predecessorIds: [] }),
    ]);

    expect(tasks.find(t => t.id === 'B')?.predecessorIds).toEqual(['A']);
    expect(corrections).toEqual([
      { taskId: 'B', field: 'predecessor', ids: ['A'] },
    ]);
  });
});
