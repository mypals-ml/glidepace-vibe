import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import {
  getTaskStableId,
  reconcileSingleTask,
  reconcileProjectSnapshot,
} from './taskReconciliation';

let taskCounter = 0;

function makeTask(overrides: Partial<Task> = {}): Task {
  taskCounter += 1;
  const id = overrides.id || `id-${taskCounter}`;
  return {
    id,
    displayId: `#${taskCounter}`,
    title: `Task ${taskCounter}`,
    startDate: '2026-01-05',
    targetDate: '2026-01-09',
    status: 'Todo',
    assignees: [],
    progress: 0,
    itemId: `item-${id}`,
    contentId: `content-${id}`,
    ...overrides,
  };
}

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task;
}

const OPTIONS = { fixedStartDateMode: 'ask' as const };

describe('getTaskStableId', () => {
  it('prefers itemId, then contentId, then id', () => {
    expect(getTaskStableId(makeTask({ id: 'a', itemId: 'i', contentId: 'c' }))).toBe('i');
    expect(getTaskStableId(makeTask({ id: 'a', itemId: undefined, contentId: 'c' }))).toBe('c');
    expect(getTaskStableId(makeTask({ id: 'a', itemId: undefined, contentId: undefined }))).toBe('a');
  });
});

describe('reconcileSingleTask', () => {
  it('updates the matching task and preserves unrelated task references', () => {
    const a = makeTask();
    const b = makeTask();
    const c = makeTask();
    const currentTasks = [a, b, c];

    const fetchedB = cloneTask(b);
    fetchedB.title = 'Updated remotely';

    const result = reconcileSingleTask(currentTasks, fetchedB, OPTIONS);

    expect(result.needsFullRefresh).toBe(false);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toBe(a);
    expect(result.tasks[2]).toBe(c);
    expect(result.tasks[1]).not.toBe(b);
    expect(result.tasks[1].title).toBe('Updated remotely');
    expect(result.changedTaskIds).toEqual([getTaskStableId(b)]);
  });

  it('returns the same array instance when nothing changed', () => {
    const a = makeTask();
    const b = makeTask();
    const currentTasks = [a, b];

    const result = reconcileSingleTask(currentTasks, cloneTask(b), OPTIONS);

    expect(result.tasks).toBe(currentTasks);
    expect(result.changedTaskIds).toEqual([]);
  });

  it('reports needsFullRefresh for an unknown task when insertMissing is false', () => {
    const currentTasks = [makeTask()];
    const unknown = makeTask();

    const result = reconcileSingleTask(currentTasks, unknown, OPTIONS);

    expect(result.needsFullRefresh).toBe(true);
    expect(result.tasks).toBe(currentTasks);
  });

  it('appends an unknown task when insertMissing is true', () => {
    const a = makeTask();
    const unknown = makeTask();

    const result = reconcileSingleTask([a], unknown, { ...OPTIONS, insertMissing: true });

    expect(result.needsFullRefresh).toBe(false);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toBe(a);
    expect(getTaskStableId(result.tasks[1])).toBe(getTaskStableId(unknown));
  });

  it('protects recent local edits', () => {
    const now = Date.now();
    const local = makeTask({ title: 'Local title', localUpdateTimestamp: now - 5_000 });
    const fetched = cloneTask(local);
    fetched.title = 'Stale remote title';

    const result = reconcileSingleTask([local], fetched, { ...OPTIONS, now });

    expect(result.tasks[0].title).toBe('Local title');
  });

  it('accepts remote values once the local protection window expired', () => {
    const now = Date.now();
    const local = makeTask({ title: 'Local title', localUpdateTimestamp: now - 60_000 });
    const fetched = cloneTask(local);
    fetched.title = 'Newer remote title';

    const result = reconcileSingleTask([local], fetched, { ...OPTIONS, now });

    expect(result.tasks[0].title).toBe('Newer remote title');
  });

  it('cascades dependency-derived dates to floating successors only', () => {
    const predecessor = makeTask({ targetDate: '2026-01-05', successorIds: [] });
    const floating = makeTask({ startDate: '', targetDate: '', predecessorIds: [predecessor.itemId!] });
    predecessor.successorIds = [floating.itemId!];
    const fixed = makeTask({ startDate: '2026-02-02' });

    const fetchedPredecessor = cloneTask(predecessor);
    fetchedPredecessor.targetDate = '2026-01-12';

    const result = reconcileSingleTask([predecessor, floating, fixed], fetchedPredecessor, OPTIONS);

    // 2026-01-12 is a Monday; the floating successor starts the next workday.
    expect(result.tasks[1].tempStartDate).toBe('2026-01-13');
    expect(result.tasks[2]).toBe(fixed);
  });
});

describe('reconcileProjectSnapshot', () => {
  it('preserves references for unchanged tasks and replaces changed ones', () => {
    const a = makeTask();
    const b = makeTask();
    const c = makeTask();
    const currentTasks = [a, b, c];

    const fetchedB = cloneTask(b);
    fetchedB.status = 'Done';
    const snapshot = [cloneTask(a), fetchedB, cloneTask(c)];

    const result = reconcileProjectSnapshot(currentTasks, snapshot, OPTIONS);

    expect(result.tasks[0]).toBe(a);
    expect(result.tasks[2]).toBe(c);
    expect(result.tasks[1]).not.toBe(b);
    expect(result.tasks[1].status).toBe('Done');
    expect(result.updatedTaskIds).toEqual([getTaskStableId(b)]);
    expect(result.addedTaskIds).toEqual([]);
    expect(result.removedTaskIds).toEqual([]);
  });

  it('returns the same array instance for an identical snapshot', () => {
    const currentTasks = [makeTask(), makeTask()];
    const snapshot = currentTasks.map(cloneTask);

    const result = reconcileProjectSnapshot(currentTasks, snapshot, OPTIONS);

    expect(result.tasks).toBe(currentTasks);
    expect(result.updatedTaskIds).toEqual([]);
    expect(result.movedTaskIds).toEqual([]);
  });

  it('removes missing tasks and keeps the snapshot order from GitHub', () => {
    const a = makeTask();
    const b = makeTask();
    const c = makeTask();
    const currentTasks = [a, b, c];

    const snapshot = [cloneTask(c), cloneTask(a)];

    const result = reconcileProjectSnapshot(currentTasks, snapshot, OPTIONS);

    expect(result.tasks.map(getTaskStableId)).toEqual([getTaskStableId(c), getTaskStableId(a)]);
    expect(result.removedTaskIds).toEqual([getTaskStableId(b)]);
    expect(result.movedTaskIds.length).toBeGreaterThan(0);
    // Surviving unchanged tasks keep their references even after moving.
    expect(result.tasks[0]).toBe(c);
    expect(result.tasks[1]).toBe(a);
  });

  it('detects added tasks', () => {
    const a = makeTask();
    const added = makeTask();
    const snapshot = [cloneTask(a), cloneTask(added)];

    const result = reconcileProjectSnapshot([a], snapshot, OPTIONS);

    expect(result.addedTaskIds).toEqual([getTaskStableId(added)]);
    expect(result.tasks[0]).toBe(a);
  });

  it('protects recent local edits in a full snapshot', () => {
    const now = Date.now();
    const local = makeTask({ title: 'Local title', localUpdateTimestamp: now - 5_000 });
    const fetched = cloneTask(local);
    fetched.title = 'Stale remote title';

    const result = reconcileProjectSnapshot([local], [fetched], { ...OPTIONS, now });

    expect(result.tasks[0].title).toBe('Local title');
  });

  it('preserves existing comments when the snapshot omits them', () => {
    const withComments = makeTask({
      comments: [{
        id: 'comment-1',
        body: 'hello',
        createdAt: '2026-01-01T00:00:00Z',
        author: { id: 'u1', name: 'User', avatarColor: '', initials: 'US' },
      }],
    });
    const fetched = cloneTask(withComments);
    delete fetched.comments;

    const result = reconcileProjectSnapshot([withComments], [fetched], OPTIONS);

    expect(result.tasks[0].comments).toHaveLength(1);
    expect(result.tasks[0].comments?.[0].id).toBe('comment-1');
  });
});
