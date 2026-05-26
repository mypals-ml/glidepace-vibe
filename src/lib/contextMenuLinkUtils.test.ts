import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { buildBreakLinkPlan } from './contextMenuLinkUtils';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id || 'task',
    itemId: overrides.itemId || overrides.id || 'task',
    displayId: overrides.displayId || overrides.id || 'task',
    title: overrides.title || overrides.id || 'task',
    startDate: overrides.startDate ?? '2026-05-25',
    targetDate: overrides.targetDate ?? '2026-05-25',
    status: overrides.status || 'Todo',
    assignees: overrides.assignees || [],
    progress: overrides.progress || 0,
    estimate: overrides.estimate ?? 1,
    estimateUnit: overrides.estimateUnit || 'days',
    successorIds: overrides.successorIds,
    predecessorIds: overrides.predecessorIds,
  };
}

describe('buildBreakLinkPlan', () => {
  it('builds break-all operations for both inbound and outbound task links', () => {
    const predecessor = makeTask({ id: 'A', itemId: 'item-a', successorIds: ['item-b'] });
    const current = makeTask({ id: 'B', itemId: 'item-b', successorIds: ['item-c'] });
    const successor = makeTask({ id: 'C', itemId: 'item-c' });

    const plan = buildBreakLinkPlan(
      [predecessor, current, successor],
      { firstTask: current, lastTask: current },
      'all',
    );

    expect(plan.hasPredecessors).toBe(true);
    expect(plan.hasSuccessors).toBe(true);
    expect(plan.operations).toEqual([
      { taskId: 'item-a', successorIds: [] },
      { taskId: 'item-b', successorIds: [] },
    ]);
  });

  it('keeps unrelated predecessor successor links when breaking all links for the selected task', () => {
    const predecessor = makeTask({ id: 'A', itemId: 'item-a', successorIds: ['item-b', 'item-c'] });
    const current = makeTask({ id: 'B', itemId: 'item-b', successorIds: ['item-c'] });
    const successor = makeTask({ id: 'C', itemId: 'item-c' });

    const plan = buildBreakLinkPlan(
      [predecessor, current, successor],
      { firstTask: current, lastTask: current },
      'all',
    );

    expect(plan.operations).toEqual([
      { taskId: 'item-a', successorIds: ['item-c'] },
      { taskId: 'item-b', successorIds: [] },
    ]);
  });

  it('builds predecessor-only operations without clearing successors', () => {
    const predecessor = makeTask({ id: 'A', itemId: 'item-a', successorIds: ['item-b'] });
    const current = makeTask({ id: 'B', itemId: 'item-b', successorIds: ['item-c'] });

    const plan = buildBreakLinkPlan(
      [predecessor, current],
      { firstTask: current, lastTask: current },
      'predecessors',
    );

    expect(plan.hasPredecessors).toBe(true);
    expect(plan.hasSuccessors).toBe(true);
    expect(plan.operations).toEqual([
      { taskId: 'item-a', successorIds: [] },
    ]);
  });

  it('builds successor-only operations without touching predecessors', () => {
    const predecessor = makeTask({ id: 'A', itemId: 'item-a', successorIds: ['item-b'] });
    const current = makeTask({ id: 'B', itemId: 'item-b', successorIds: ['item-c'] });

    const plan = buildBreakLinkPlan(
      [predecessor, current],
      { firstTask: current, lastTask: current },
      'successors',
    );

    expect(plan.hasPredecessors).toBe(true);
    expect(plan.hasSuccessors).toBe(true);
    expect(plan.operations).toEqual([
      { taskId: 'item-b', successorIds: [] },
    ]);
  });

  it('uses the first task for predecessors and last task for successors when breaking a group boundary', () => {
    const inbound = makeTask({ id: 'A', itemId: 'item-a', successorIds: ['item-b'] });
    const first = makeTask({ id: 'B', itemId: 'item-b' });
    const last = makeTask({ id: 'C', itemId: 'item-c', successorIds: ['item-d'] });
    const outbound = makeTask({ id: 'D', itemId: 'item-d' });

    const plan = buildBreakLinkPlan(
      [inbound, first, last, outbound],
      { firstTask: first, lastTask: last },
      'all',
    );

    expect(plan.operations).toEqual([
      { taskId: 'item-a', successorIds: [] },
      { taskId: 'item-c', successorIds: [] },
    ]);
  });

  it('reports when no matching links exist', () => {
    const current = makeTask({ id: 'B', itemId: 'item-b', successorIds: [] });

    const plan = buildBreakLinkPlan(
      [current],
      { firstTask: current, lastTask: current },
      'all',
    );

    expect(plan.hasPredecessors).toBe(false);
    expect(plan.hasSuccessors).toBe(false);
    expect(plan.operations).toEqual([]);
  });
});
