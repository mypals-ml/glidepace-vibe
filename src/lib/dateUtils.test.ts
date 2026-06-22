import { describe, it, expect } from 'vitest';
import { calculateTargetDate, shiftDateByDays, isDoneStatus, getCurrentLocalDate } from './dateUtils';
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

describe('Status-to-Done date helpers (for auto Start Date on Done)', () => {
  it('isDoneStatus detects Done variants case-insensitively', () => {
    expect(isDoneStatus('Done')).toBe(true);
    expect(isDoneStatus('done')).toBe(true);
    expect(isDoneStatus('DONE')).toBe(true);
    expect(isDoneStatus('Completed')).toBe(true);
    expect(isDoneStatus('closed')).toBe(true);
    expect(isDoneStatus('Merged')).toBe(true);
  });

  it('isDoneStatus returns false for non-done statuses', () => {
    expect(isDoneStatus('Todo')).toBe(false);
    expect(isDoneStatus('In Progress')).toBe(false);
    expect(isDoneStatus('Backlog')).toBe(false);
    expect(isDoneStatus('')).toBe(false);
    expect(isDoneStatus(undefined as unknown as string)).toBe(false);
    expect(isDoneStatus(null as unknown as string)).toBe(false);
    expect(isDoneStatus('done-but-not')).toBe(false);
  });

  it('getCurrentLocalDate returns valid YYYY-MM-DD local format', () => {
    const d = getCurrentLocalDate();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Sanity: should be close to now (within a day of test env)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const expectedToday = `${year}-${month}-${day}`;
    // Allow for very rare midnight cross in test, but usually equal
    expect([expectedToday, /* rare off-by-one local vs iso but we use local */]).toContain(d);
    // At minimum validate it is a real parseable date string
    expect(new Date(d).toString()).not.toBe('Invalid Date');
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

  it('keeps existing successor link order when auto-correcting missing reverse links', () => {
    const { tasks, corrections } = autoCorrectDependencyFields([
      makeTask({ id: 'A', itemId: 'A', successorIds: ['C', 'B'] }),
      makeTask({ id: 'D', itemId: 'D', predecessorIds: ['A'] }),
      makeTask({ id: 'C', itemId: 'C', predecessorIds: ['A'] }),
      makeTask({ id: 'B', itemId: 'B', predecessorIds: ['A'] }),
    ]);

    expect(tasks.find(t => t.id === 'A')?.successorIds).toEqual(['C', 'B', 'D']);
    expect(corrections).toEqual([
      { taskId: 'A', field: 'successor', ids: ['C', 'B', 'D'] },
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

  it('keeps existing predecessor link order when auto-correcting missing reverse links', () => {
    const { tasks, corrections } = autoCorrectDependencyFields([
      makeTask({ id: 'C', itemId: 'C', successorIds: ['D'] }),
      makeTask({ id: 'B', itemId: 'B', successorIds: ['D'] }),
      makeTask({ id: 'A', itemId: 'A', successorIds: ['D'] }),
      makeTask({ id: 'D', itemId: 'D', predecessorIds: ['C', 'B'] }),
    ]);

    expect(tasks.find(t => t.id === 'D')?.predecessorIds).toEqual(['C', 'B', 'A']);
    expect(corrections).toEqual([
      { taskId: 'D', field: 'predecessor', ids: ['C', 'B', 'A'] },
    ]);
  });
});
