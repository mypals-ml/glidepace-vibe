import { describe, expect, it } from 'vitest';
import type { DashboardItem, Task, TaskGroupBlock } from '../types';
import {
  getDashboardGroupDropPlan,
  getDashboardTaskGroupPathMovePlan,
  getAfterIdForAppend,
  getAfterIdForInsertPosition,
  getGroupPathForCreatedTaskTarget,
  getGroupSortId,
  getTaskSortId,
  getVisibleDashboardMovePlan,
  getAfterIdForVisibleMove,
  moveTaskAfter,
  moveTaskBlockAfter,
  upsertTaskAfter,
} from './taskOrderUtils';

const makeTask = (id: string, groupPathOrIndex: string[] | number = []): Task => ({
  id,
  itemId: id,
  displayId: id,
  title: id,
  groupPath: Array.isArray(groupPathOrIndex) ? groupPathOrIndex : [],
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
  endTaskIndex = childTaskIds.length - 1,
  path = [groupBlockId]
): TaskGroupBlock => ({
  kind: 'group',
  groupBlockId,
  name: groupBlockId,
  path,
  depth: path.length,
  startTaskIndex,
  endTaskIndex,
  startDate: '',
  targetDate: '',
  childTaskIds,
  isExpanded: true,
});

const makeRootGroup = (childTaskIds: string[]): TaskGroupBlock => ({
  ...makeGroup('project-root', childTaskIds, 0, childTaskIds.length - 1, []),
  name: 'Project',
  isSyntheticRoot: true,
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

  it('inserts a newly created task after the current last task', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(ids(upsertTaskAfter(tasks, makeTask('D'), 'C'))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('inserts a newly created task above a target task', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(ids(upsertTaskAfter(tasks, makeTask('D'), 'A'))).toEqual(['A', 'D', 'B', 'C']);
  });

  it('moves an existing fetched task into the requested create position', () => {
    const tasks = ['A', 'B', 'C', 'D'].map(makeTask);

    expect(ids(upsertTaskAfter(tasks, { ...makeTask('D'), title: 'Fetched D' }, 'A'))).toEqual(['A', 'D', 'B', 'C']);
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

  it('plans dropping a task into a group at the end of that group block', () => {
    const targetGroup = makeGroup('Target', ['B', 'C'], 1, 2, ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B', 'C']),
      makeTask('A'),
      targetGroup,
      makeTask('B', ['Target']),
      makeTask('C', ['Target']),
    ];

    expect(getDashboardGroupDropPlan(items, getTaskSortId(makeTask('A')), getGroupSortId(targetGroup))).toEqual({
      taskId: 'A',
      targetGroupPath: ['Target'],
      afterTaskId: 'C',
    });
  });

  it('plans dropping a grouped task onto the root group to ungroup it', () => {
    const rootGroup = makeRootGroup(['A', 'B', 'C']);
    const sourceGroup = makeGroup('Source', ['B'], 1, 1, ['Source']);
    const items: DashboardItem[] = [
      rootGroup,
      makeTask('A'),
      sourceGroup,
      makeTask('B', ['Source']),
      makeTask('C'),
    ];

    expect(getDashboardGroupDropPlan(items, getTaskSortId(makeTask('B', ['Source'])), getGroupSortId(rootGroup))).toEqual({
      taskId: 'B',
      targetGroupPath: [],
      afterTaskId: 'C',
    });
  });

  it('plans moving a task from one group to another group', () => {
    const sourceGroup = makeGroup('Source', ['A'], 0, 0, ['Source']);
    const targetGroup = makeGroup('Target', ['B'], 1, 1, ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      sourceGroup,
      makeTask('A', ['Source']),
      targetGroup,
      makeTask('B', ['Target']),
    ];

    expect(getDashboardGroupDropPlan(items, getTaskSortId(makeTask('A', ['Source'])), getGroupSortId(targetGroup))).toEqual({
      taskId: 'A',
      targetGroupPath: ['Target'],
      afterTaskId: 'B',
    });
  });

  it('plans changing group path when a task is dropped over a task in another group', () => {
    const sourceGroup = makeGroup('Source', ['A'], 0, 0, ['Source']);
    const targetGroup = makeGroup('Target', ['B'], 1, 1, ['Target']);
    const activeTask = makeTask('A', ['Source']);
    const overTask = makeTask('B', ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      sourceGroup,
      activeTask,
      targetGroup,
      overTask,
    ];

    expect(getDashboardTaskGroupPathMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toEqual({
      taskId: 'A',
      targetGroupPath: ['Target'],
      afterTaskId: 'B',
    });
  });

  it('does not change group path for task-over-task reorders within the same group', () => {
    const group = makeGroup('Target', ['A', 'B'], 0, 1, ['Target']);
    const activeTask = makeTask('A', ['Target']);
    const overTask = makeTask('B', ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      group,
      activeTask,
      overTask,
    ];

    expect(getDashboardTaskGroupPathMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toBeUndefined();
  });

  it('keeps context-created tasks in the same group when starting from a task row', () => {
    expect(getGroupPathForCreatedTaskTarget(makeTask('A', ['Parent', 'Child']))).toEqual(['Parent', 'Child']);
  });

  it('places context-created tasks outside the selected group row', () => {
    const group = makeGroup('Child', ['A'], 0, 0, ['Parent', 'Child']);

    expect(getGroupPathForCreatedTaskTarget(group)).toEqual(['Parent']);
  });

  it('places context-created tasks from the root group at the project root', () => {
    expect(getGroupPathForCreatedTaskTarget(makeRootGroup(['A']))).toEqual([]);
  });

  it('calculates insert position above a target', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForInsertPosition(tasks, { targetTaskId: 'B', placement: 'above' })).toBe('A');
  });

  it('calculates insert position below a target', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForInsertPosition(tasks, { targetTaskId: 'B', placement: 'below' })).toBe('B');
  });

  it('calculates append position after the current last task', () => {
    const tasks = ['A', 'B', 'C'].map(makeTask);

    expect(getAfterIdForAppend(tasks)).toBe('C');
  });

  it('calculates append position for an empty task list', () => {
    expect(getAfterIdForAppend([])).toBeNull();
  });
});
