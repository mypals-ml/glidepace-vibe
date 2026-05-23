import { describe, expect, it } from 'vitest';
import type { DashboardItem, Task, TaskGroupBlock } from '../types';
import {
  getAfterIdForInsertPosition,
  getGroupSortId,
  getTaskSortId,
  getVisibleDashboardMovePlan,
  getAfterIdForVisibleMove,
  moveTaskAfter,
  moveTaskBlockAfter,
} from './taskOrderUtils';

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

const makeGroup = (
  groupBlockId: string,
  childTaskIds: string[],
  startTaskIndex = 0,
  endTaskIndex = childTaskIds.length - 1
): TaskGroupBlock => ({
  kind: 'group',
  groupBlockId,
  name: groupBlockId,
  path: [groupBlockId],
  depth: 1,
  startTaskIndex,
  endTaskIndex,
  startDate: '',
  targetDate: '',
  childTaskIds,
  isExpanded: true,
});

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

  it('moves a task block while preserving internal order', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E'].map(makeTask);

    expect(ids(moveTaskBlockAfter(tasks, ['B', 'C'], 'E'))).toEqual(['A', 'D', 'E', 'B', 'C']);
  });

  it('moves a task block to the top', () => {
    const tasks = ['A', 'B', 'C', 'D'].map(makeTask);

    expect(ids(moveTaskBlockAfter(tasks, ['C', 'D'], null))).toEqual(['C', 'D', 'A', 'B']);
  });

  it('leaves a block unchanged when targeting one of its own tasks', () => {
    const tasks = ['A', 'B', 'C', 'D'].map(makeTask);

    expect(ids(moveTaskBlockAfter(tasks, ['B', 'C'], 'B'))).toEqual(['A', 'B', 'C', 'D']);
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

  it('calculates a whole group block move relative to a task row', () => {
    const group = makeGroup('group-1', ['B', 'C'], 1, 2);
    const items: DashboardItem[] = [makeTask('A'), group, makeTask('B'), makeTask('C'), makeTask('D')];

    expect(getVisibleDashboardMovePlan(items, getGroupSortId(group), getTaskSortId(makeTask('D')))).toEqual({
      taskIds: ['B', 'C'],
      afterTaskId: 'D',
    });
  });

  it('calculates a whole group block move to the top', () => {
    const group = makeGroup('group-1', ['C', 'D'], 2, 3);
    const items: DashboardItem[] = [makeTask('A'), makeTask('B'), group, makeTask('C'), makeTask('D')];

    expect(getVisibleDashboardMovePlan(items, getGroupSortId(group), getTaskSortId(makeTask('A')))).toEqual({
      taskIds: ['C', 'D'],
      afterTaskId: null,
    });
  });

  it('calculates a whole group block move relative to another group row', () => {
    const sourceGroup = makeGroup('group-1', ['B', 'C'], 1, 2);
    const targetGroup = makeGroup('group-2', ['E', 'F'], 4, 5);
    const items: DashboardItem[] = [
      makeTask('A'),
      sourceGroup,
      makeTask('B'),
      makeTask('C'),
      makeTask('D'),
      targetGroup,
      makeTask('E'),
      makeTask('F'),
    ];

    expect(getVisibleDashboardMovePlan(items, getGroupSortId(sourceGroup), getGroupSortId(targetGroup))).toEqual({
      taskIds: ['B', 'C'],
      afterTaskId: 'F',
    });
  });

  it('returns undefined when dragging a group over one of its own child tasks', () => {
    const group = makeGroup('group-1', ['B', 'C'], 1, 2);
    const items: DashboardItem[] = [makeTask('A'), group, makeTask('B'), makeTask('C'), makeTask('D')];

    expect(getVisibleDashboardMovePlan(items, getGroupSortId(group), getTaskSortId(makeTask('B')))).toBeUndefined();
  });

  it('resolves nested child task IDs when planning a group move', () => {
    const parentGroup = makeGroup('parent', ['B', 'C', 'D'], 1, 3);
    const childGroup = makeGroup('child', ['C', 'D'], 2, 3);
    const items: DashboardItem[] = [
      makeTask('A'),
      parentGroup,
      makeTask('B'),
      childGroup,
      makeTask('C'),
      makeTask('D'),
      makeTask('E'),
    ];

    expect(getVisibleDashboardMovePlan(items, getGroupSortId(parentGroup), getTaskSortId(makeTask('E')))).toEqual({
      taskIds: ['B', 'C', 'D'],
      afterTaskId: 'E',
    });
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
