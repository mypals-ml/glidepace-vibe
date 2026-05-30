import { describe, expect, it } from 'vitest';
import { mergeFetchedTaskWithLocalState } from './taskMergeUtils';
import type { Task } from '../types';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id || 'B',
  itemId: overrides.itemId || overrides.id || 'B',
  displayId: overrides.displayId || overrides.id || 'B',
  title: overrides.title || overrides.id || 'B',
  body: overrides.body,
  comments: 'comments' in overrides ? overrides.comments : [],
  startDate: overrides.startDate || '2026-03-23',
  targetDate: overrides.targetDate || '2026-03-23',
  tempStartDate: overrides.tempStartDate,
  tempTargetDate: overrides.tempTargetDate,
  status: overrides.status || 'Todo',
  assignees: overrides.assignees || [],
  progress: overrides.progress || 0,
  autoUpdateStartDate: overrides.autoUpdateStartDate,
  successorIds: overrides.successorIds,
  predecessorIds: overrides.predecessorIds,
  localUpdateTimestamp: overrides.localUpdateTimestamp,
});

describe('mergeFetchedTaskWithLocalState', () => {
  it('preserves recently shifted dates when a dependency-source refetch is stale', () => {
    const now = 1778916600000;
    const existing = makeTask({
      startDate: '2026-03-24',
      targetDate: '2026-03-24',
      tempStartDate: '2026-03-25',
      tempTargetDate: '2026-03-25',
      successorIds: ['C'],
      predecessorIds: ['A'],
      autoUpdateStartDate: 'auto',
      localUpdateTimestamp: now,
    });
    const staleFetched = makeTask({
      startDate: '2026-03-23',
      targetDate: '2026-03-23',
      successorIds: ['C'],
      predecessorIds: [],
      autoUpdateStartDate: 'ask',
    });

    const merged = mergeFetchedTaskWithLocalState(existing, staleFetched, now + 1000);

    expect(merged.startDate).toBe('2026-03-24');
    expect(merged.targetDate).toBe('2026-03-24');
    expect(merged.tempStartDate).toBe('2026-03-25');
    expect(merged.tempTargetDate).toBe('2026-03-25');
    expect(merged.successorIds).toEqual(['C']);
    expect(merged.predecessorIds).toEqual(['A']);
    expect(merged.autoUpdateStartDate).toBe('auto');
  });

  it('preserves local fields (title, body, status, progress, comments, assignees) during protection window', () => {
    const now = 1778916600000;
    const existingComments = [{
      id: 'comment-1',
      author: { id: 'user-1', name: 'User One', initials: 'U1', avatarColor: 'bg-red-100' },
      body: 'Existing comment content',
      createdAt: '2026-03-24T12:00:00Z',
    }];
    const existingAssignees = [{ id: 'user-1', name: 'User One', login: 'user1', initials: 'U1', avatarColor: 'bg-red-100' }];

    const existing = makeTask({
      title: 'Local Updated Title',
      body: 'Local Updated Body',
      status: 'In Progress',
      progress: 50,
      comments: existingComments,
      assignees: existingAssignees,
      localUpdateTimestamp: now,
    });

    const staleFetched = makeTask({
      title: 'Old Stale Title',
      body: 'Old Stale Body',
      status: 'Todo',
      progress: 0,
      comments: [],
      assignees: [],
    });

    const merged = mergeFetchedTaskWithLocalState(existing, staleFetched, now + 1000);

    expect(merged.title).toBe('Local Updated Title');
    expect(merged.body).toBe('Local Updated Body');
    expect(merged.status).toBe('In Progress');
    expect(merged.progress).toBe(50);
    expect(merged.comments).toEqual(existingComments);
    expect(merged.assignees).toEqual(existingAssignees);
  });

  it('preserves existing comments when fetched.comments is undefined, even outside protection window', () => {
    const existingComments = [{
      id: 'comment-1',
      author: { id: 'user-1', name: 'User One', initials: 'U1', avatarColor: 'bg-red-100' },
      body: 'Existing comment content',
      createdAt: '2026-03-24T12:00:00Z',
    }];
    const existing = makeTask({
      comments: existingComments,
      localUpdateTimestamp: undefined,
    });
    const fetched = makeTask({
      comments: undefined,
    });

    const merged = mergeFetchedTaskWithLocalState(existing, fetched);
    expect(merged.comments).toEqual(existingComments);
  });
});
