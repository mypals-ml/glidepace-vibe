import { describe, it, expect } from 'vitest';
import type { DashboardItem, Task, TaskGroupBlock } from '../types';
import {
  captureViewportAnchor,
  resolveViewportAnchor,
  getDashboardItemStableId,
  DASHBOARD_ROW_HEIGHT_PX,
} from './viewportAnchor';

let counter = 0;

function makeTaskItem(id?: string): Task {
  counter += 1;
  const taskId = id || `t-${counter}`;
  return {
    id: taskId,
    displayId: `#${counter}`,
    title: `Task ${taskId}`,
    startDate: '',
    targetDate: '',
    status: 'Todo',
    assignees: [],
    progress: 0,
    itemId: `item-${taskId}`,
  };
}

function makeGroupItem(id?: string): TaskGroupBlock {
  counter += 1;
  const groupId = id || `g-${counter}`;
  return {
    kind: 'group',
    groupBlockId: groupId,
    name: `Group ${groupId}`,
    path: [groupId],
    depth: 0,
    startTaskIndex: 0,
    endTaskIndex: 0,
    startDate: '',
    targetDate: '',
    childTaskIds: [],
    isExpanded: true,
  };
}

const ROW = DASHBOARD_ROW_HEIGHT_PX;

describe('getDashboardItemStableId', () => {
  it('uses groupBlockId for groups and itemId for tasks', () => {
    expect(getDashboardItemStableId(makeGroupItem('g1'))).toBe('g1');
    expect(getDashboardItemStableId(makeTaskItem('t1'))).toBe('item-t1');
  });
});

describe('captureViewportAnchor', () => {
  it('captures visible task rows top to bottom with their offsets', () => {
    const items: DashboardItem[] = Array.from({ length: 20 }, () => makeTaskItem());
    // Viewport shows rows 2..5 (scrollTop 2 rows, height 4 rows).
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 2 * ROW,
      viewportHeight: 4 * ROW,
    });

    expect(anchor).not.toBeNull();
    expect(anchor!.candidates[0].stableId).toBe(getDashboardItemStableId(items[2]));
    expect(anchor!.candidates[0].offsetFromViewportTop).toBe(0);
    expect(anchor!.candidates[1].offsetFromViewportTop).toBe(ROW);
  });

  it('orders task candidates before group candidates', () => {
    const group = makeGroupItem();
    const task = makeTaskItem();
    const items: DashboardItem[] = [group, task];

    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 0,
      viewportHeight: 2 * ROW,
    });

    expect(anchor!.candidates[0].kind).toBe('task');
    expect(anchor!.candidates[0].stableId).toBe(getDashboardItemStableId(task));
    expect(anchor!.candidates[1].kind).toBe('group');
  });

  it('returns null for an empty item list', () => {
    expect(captureViewportAnchor({ dashboardItems: [], scrollTop: 0, viewportHeight: 500 })).toBeNull();
  });
});

describe('resolveViewportAnchor', () => {
  it('restores the first visible task at its captured offset when it moved', () => {
    const items: DashboardItem[] = Array.from({ length: 20 }, () => makeTaskItem());
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 3 * ROW + 10,
      viewportHeight: 4 * ROW,
    })!;
    const topVisible = items[3];

    // Top visible task moved from index 3 to index 8.
    const reordered = [...items.filter(i => i !== topVisible)];
    reordered.splice(8, 0, topVisible);

    const scrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems: reordered,
      maxScrollTop: 100 * ROW,
    });

    // Captured offset was -10px (row top slightly above viewport top).
    expect(scrollTop).toBe(8 * ROW - (3 * ROW - (3 * ROW + 10)));
    expect(scrollTop).toBe(8 * ROW + 10);
  });

  it('falls back to the next visible task when the top one was deleted', () => {
    const items: DashboardItem[] = Array.from({ length: 10 }, () => makeTaskItem());
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 2 * ROW,
      viewportHeight: 3 * ROW,
    })!;

    // Delete the top visible task (index 2); next candidate is old index 3.
    const next = items.filter((_, index) => index !== 2);

    const scrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems: next,
      maxScrollTop: 100 * ROW,
    });

    // Old index 3 is now index 2; captured offset was ROW.
    expect(scrollTop).toBe(2 * ROW - ROW);
  });

  it('falls back to the previous scrollTop clamped when no candidate survived', () => {
    const items: DashboardItem[] = Array.from({ length: 10 }, () => makeTaskItem());
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 5 * ROW,
      viewportHeight: 2 * ROW,
    })!;

    const replaced: DashboardItem[] = Array.from({ length: 4 }, () => makeTaskItem());

    const scrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems: replaced,
      maxScrollTop: 2 * ROW,
    });

    expect(scrollTop).toBe(2 * ROW);
  });

  it('uses a surviving group candidate when all task candidates disappeared', () => {
    const group = makeGroupItem();
    const taskA = makeTaskItem();
    const taskB = makeTaskItem();
    const items: DashboardItem[] = [group, taskA, taskB];
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 0,
      viewportHeight: 3 * ROW,
    })!;

    // Both tasks removed; the group moved down one row.
    const next: DashboardItem[] = [makeTaskItem(), group];

    const scrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems: next,
      maxScrollTop: 100 * ROW,
    });

    expect(scrollTop).toBe(ROW);
  });

  it('clamps the resolved scrollTop to valid bounds', () => {
    const items: DashboardItem[] = Array.from({ length: 5 }, () => makeTaskItem());
    const anchor = captureViewportAnchor({
      dashboardItems: items,
      scrollTop: 4 * ROW,
      viewportHeight: ROW,
    })!;

    const scrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems: items,
      maxScrollTop: ROW,
    });

    expect(scrollTop).toBeLessThanOrEqual(ROW);
    expect(scrollTop).toBeGreaterThanOrEqual(0);
  });
});
