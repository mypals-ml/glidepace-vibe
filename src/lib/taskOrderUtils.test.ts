import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { getAfterIdForInsertPosition, getAfterIdForVisibleMove, moveTaskAfter } from './taskOrderUtils';

const makeTask = (id: string): Task => ({
  id,
  itemId: id,
  displayId: id,
  title: id,
  startDate: '',
  targetDate: '',
  status: 'Todo',
  assignees: [],
  progress: 0,
});

const ids = (tasks: Task[]) => tasks.map(task => task.itemId || task.id);

describe('taskOrderUtils', () => {
  it('moves an item down many positions with one after-id target', () => {
    const tasks = Array.from({ length: 60 }, (_, index) => makeTask(`task-${index + 1}`));

    expect(ids(moveTaskAfter(tasks, 'task-2', 'task-52')).slice(48, 54)).toEqual([
      'task-50',
      'task-51',
      'task-52',
      'task-2',
      'task-53',
      'task-54',
    ]);
  });

  it('moves an item up many positions', () => {
    const tasks = Array.from({ length: 60 }, (_, index) => makeTask(`task-${index + 1}`));

    expect(ids(moveTaskAfter(tasks, 'task-55', 'task-4')).slice(0, 7)).toEqual([
      'task-1',
      'task-2',
      'task-3',
      'task-4',
      'task-55',
      'task-5',
      'task-6',
    ]);
  });

  it('moves an item to the top when after-id is null', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(ids(moveTaskAfter(tasks, 'C', null))).toEqual(['C', 'A', 'B']);
  });

  it('moves an item to the bottom', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(ids(moveTaskAfter(tasks, 'A', 'C'))).toEqual(['B', 'C', 'A']);
  });

  it('calculates the visible predecessor for filtered-list reorder', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(makeTask);
    const visibleTasks = tasks.filter(task => ['B', 'E', 'H'].includes(task.id));

    expect(getAfterIdForVisibleMove(visibleTasks, 'H', 'E')).toBe('B');
  });

  it('returns undefined for a no-op visible drag', () => {
    const visibleTasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForVisibleMove(visibleTasks, 'B', 'B')).toBeUndefined();
  });

  it('calculates insert position above a target', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForInsertPosition(tasks, { targetTaskId: 'B', placement: 'above' })).toBe('A');
  });

  it('calculates insert position below a target', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForInsertPosition(tasks, { targetTaskId: 'B', placement: 'below' })).toBe('B');
  });
});
