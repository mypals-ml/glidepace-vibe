import { describe, expect, it } from 'vitest';
import { moveTaskAfter } from './taskOrderUtils';
import type { Task } from '../types';
import { createRecentLocalReorderTracker, getReorderRefreshDecision } from './reorderSyncUtils';

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

describe('createRecentLocalReorderTracker', () => {
  it('matches a recently marked reorder throughout the guard window', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume('item-1', 500)).toBe(true);
    expect(tracker.consume('item-1', 500)).toBe(true);
  });

  it('does not consume expired reorder marks', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume('item-1', 1201)).toBe(false);
  });

  it('ignores unknown or missing item ids', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume(undefined, 500)).toBe(false);
    expect(tracker.consume('item-2', 500)).toBe(false);
    expect(tracker.hasRecent(500)).toBe(true);
  });

  it('moves task 10 above task 9 locally and refreshes zero rows for the matching local echo', () => {
    const tracker = createRecentLocalReorderTracker(1000);
    const tasks = Array.from({ length: 10 }, (_, index) => makeTask(`task-${index + 1}`));

    const nextTasks = moveTaskAfter(tasks, 'task-10', 'task-8');
    tracker.mark(['task-10'], 100);

    expect(ids(nextTasks)).toEqual([
      'task-1',
      'task-2',
      'task-3',
      'task-4',
      'task-5',
      'task-6',
      'task-7',
      'task-8',
      'task-10',
      'task-9',
    ]);
    expect(getReorderRefreshDecision('task-10', nextTasks.length, itemId => tracker.consume(itemId, 500))).toEqual({
      refreshKind: 'local_reorder_echo',
      refreshedItemCount: 0,
    });
  });

  it('refreshes all rows when the reorder echo is not from a recent local move', () => {
    const tracker = createRecentLocalReorderTracker(1000);
    const tasks = Array.from({ length: 10 }, (_, index) => makeTask(`task-${index + 1}`));

    expect(getReorderRefreshDecision('task-10', tasks.length, itemId => tracker.consume(itemId, 500))).toEqual({
      refreshKind: 'external_reorder_full_project',
      refreshedItemCount: 10,
    });
  });
});
