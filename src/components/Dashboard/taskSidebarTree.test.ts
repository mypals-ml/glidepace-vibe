import { describe, expect, it } from 'vitest';
import type { DashboardItem, Task, TaskGroupBlock } from '../../types';
import {
  TREE_CONTENT_GAP,
  TREE_NODE_BASE_X,
  TREE_DEPTH_STEP,
  TREE_ROW_PADDING_LEFT,
  buildDashboardTreeRows,
  getDashboardItemTreeDepth,
  getTreeDragHandleX,
  getTreeNodeX,
  getTreeRowDividerLeft,
} from './taskSidebarTree';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    kind: 'task',
    id,
    itemId: `item-${id}`,
    displayId: `#${id}`,
    title: `Task ${id}`,
    status: 'Todo',
    startDate: '2026-06-01',
    targetDate: '2026-06-02',
    assignees: [],
    progress: 0,
    groupPath: [],
    ...overrides,
  };
}

function makeGroup(id: string, depth: number, overrides: Partial<TaskGroupBlock> = {}): TaskGroupBlock {
  return {
    kind: 'group',
    groupBlockId: id,
    name: `Group ${id}`,
    path: [id],
    depth,
    startTaskIndex: 0,
    endTaskIndex: 0,
    startDate: '2026-06-01',
    targetDate: '2026-06-02',
    childTaskIds: [],
    isExpanded: true,
    ...overrides,
  };
}

describe('getDashboardItemTreeDepth', () => {
  it('uses the group depth for group blocks', () => {
    expect(getDashboardItemTreeDepth(makeGroup('g1', 2))).toBe(2);
  });

  it('uses the explicit task depth when present', () => {
    expect(getDashboardItemTreeDepth(makeTask('t1', { depth: 3 }))).toBe(3);
  });

  it('falls back to groupPath length + 1 for tasks without depth', () => {
    expect(getDashboardItemTreeDepth(makeTask('t1', { groupPath: ['a', 'b'] }))).toBe(3);
    expect(getDashboardItemTreeDepth(makeTask('t2', { groupPath: [] }))).toBe(1);
  });
});

describe('tree geometry helpers', () => {
  it('computes the node x position from the depth', () => {
    expect(getTreeNodeX(0)).toBe(TREE_NODE_BASE_X);
    expect(getTreeNodeX(2)).toBe(TREE_NODE_BASE_X + 2 * TREE_DEPTH_STEP);
  });

  it('clamps negative depths to the base position', () => {
    expect(getTreeNodeX(-5)).toBe(TREE_NODE_BASE_X);
  });

  it('keeps the drag handle at the row padding', () => {
    expect(getTreeDragHandleX()).toBe(TREE_ROW_PADDING_LEFT);
  });

  it('positions the row divider after the node and content gap', () => {
    expect(getTreeRowDividerLeft(1)).toBe(TREE_ROW_PADDING_LEFT + getTreeNodeX(1) + TREE_CONTENT_GAP);
  });
});

describe('buildDashboardTreeRows', () => {
  it('returns one row per item preserving order', () => {
    const items: DashboardItem[] = [makeGroup('g1', 0), makeTask('t1', { depth: 1 }), makeTask('t2', { depth: 1 })];

    const rows = buildDashboardTreeRows(items);

    expect(rows.map(row => row.item)).toEqual(items);
    expect(rows.map(row => row.treeMeta.depth)).toEqual([0, 1, 1]);
  });

  it('adds a starting guide segment on rows that have children', () => {
    const rows = buildDashboardTreeRows([makeGroup('g1', 0), makeTask('t1', { depth: 1 })]);

    expect(rows[0].treeMeta.guideSegments).toEqual([
      { level: 0, startsAtNode: true, endsAtJoint: false },
    ]);
  });

  it('continues parent guide lines through middle children and ends them at the last child', () => {
    const rows = buildDashboardTreeRows([
      makeGroup('g1', 0),
      makeTask('t1', { depth: 1 }),
      makeTask('t2', { depth: 1 }),
    ]);

    // middle child: the parent rail continues to the next sibling
    expect(rows[1].treeMeta.guideSegments).toEqual([
      { level: 0, startsAtNode: false, endsAtJoint: false },
    ]);
    // last child: the rail ends at the elbow joint
    expect(rows[2].treeMeta.guideSegments).toEqual([
      { level: 0, startsAtNode: false, endsAtJoint: true },
    ]);
  });

  it('tracks guide segments across nested subtrees', () => {
    const rows = buildDashboardTreeRows([
      makeGroup('g1', 0),
      makeGroup('g2', 1),
      makeTask('t1', { depth: 2 }),
      makeTask('t2', { depth: 1 }),
    ]);

    // nested task keeps the level-0 rail alive (g2 subtree is followed by a level-1 sibling)
    expect(rows[2].treeMeta.guideSegments).toEqual([
      { level: 0, startsAtNode: false, endsAtJoint: false },
      { level: 1, startsAtNode: false, endsAtJoint: true },
    ]);
    // the trailing sibling closes the level-0 rail
    expect(rows[3].treeMeta.guideSegments).toEqual([
      { level: 0, startsAtNode: false, endsAtJoint: true },
    ]);
  });

  it('returns no guide segments for a flat list of root tasks', () => {
    const rows = buildDashboardTreeRows([
      makeTask('t1', { depth: 0 }),
      makeTask('t2', { depth: 0 }),
    ]);

    expect(rows[0].treeMeta.guideSegments).toEqual([]);
    expect(rows[1].treeMeta.guideSegments).toEqual([]);
  });

  it('handles an empty item list', () => {
    expect(buildDashboardTreeRows([])).toEqual([]);
  });
});
