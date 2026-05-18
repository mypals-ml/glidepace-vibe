import { describe, expect, it } from 'vitest';
import { mergeFetchedTaskWithLocalState } from './taskMergeUtils';
import type { Task } from '../types';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id || 'B',
  itemId: overrides.itemId || overrides.id || 'B',
  displayId: overrides.displayId || overrides.id || 'B',
  title: overrides.title || overrides.id || 'B',
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
});
