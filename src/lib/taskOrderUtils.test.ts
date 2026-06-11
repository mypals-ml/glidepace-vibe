import { describe, expect, it } from 'vitest';
import type { DashboardItem, Task, TaskGroupBlock } from '../types';
import {
  getDashboardDropTargetGroupSortId,
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
      placement: 'into',
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
      placement: 'into',
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
      placement: 'into',
    });
  });

  it('plans moving a grouped task out of its group when dropped above the group header', () => {
    const group = makeGroup('Target', ['A', 'B'], 0, 1, ['Target']);
    const activeTask = makeTask('A', ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      group,
      activeTask,
      makeTask('B', ['Target']),
    ];
    const orderedTasks = [makeTask('A'), makeTask('B')];

    expect(getDashboardGroupDropPlan(items, getTaskSortId(activeTask), getGroupSortId(group), orderedTasks)).toEqual({
      taskId: 'A',
      targetGroupPath: [],
      afterTaskId: null,
      placement: 'above',
    });
  });

  it('keeps a task outside the group when dragged from below onto the group header', () => {
    const group = makeGroup('Target', ['B', 'C'], 1, 2, ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B', 'C', 'D']),
      makeTask('A'),
      group,
      makeTask('B', ['Target']),
      makeTask('C', ['Target']),
      makeTask('D'),
    ];
    const orderedTasks = ['A', 'B', 'C', 'D'].map(makeTask);

    expect(getDashboardGroupDropPlan(items, getTaskSortId(makeTask('D')), getGroupSortId(group), orderedTasks)).toEqual({
      taskId: 'D',
      targetGroupPath: [],
      afterTaskId: 'A',
      placement: 'above',
    });
  });

  it('moves a nested-group task to its parent group when dropped above the nested header', () => {
    const parentGroup = makeGroup('Parent', ['P1', 'C1', 'C2'], 0, 2, ['Parent']);
    const childGroup = makeGroup('Child', ['C1', 'C2'], 1, 2, ['Parent', 'Child']);
    const activeTask = makeTask('C1', ['Parent', 'Child']);
    const items: DashboardItem[] = [
      makeRootGroup(['P1', 'C1', 'C2']),
      parentGroup,
      makeTask('P1', ['Parent']),
      childGroup,
      activeTask,
      makeTask('C2', ['Parent', 'Child']),
    ];
    const orderedTasks = ['P1', 'C1', 'C2'].map(makeTask);

    expect(getDashboardGroupDropPlan(items, getTaskSortId(activeTask), getGroupSortId(childGroup), orderedTasks)).toEqual({
      taskId: 'C1',
      targetGroupPath: ['Parent'],
      afterTaskId: 'P1',
      placement: 'above',
    });
  });

  it('highlights the group header when a task hovers onto it from above', () => {
    const targetGroup = makeGroup('Target', ['B'], 1, 1, ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      makeTask('A'),
      targetGroup,
      makeTask('B', ['Target']),
    ];

    expect(getDashboardDropTargetGroupSortId(items, getTaskSortId(makeTask('A')), getGroupSortId(targetGroup))).toBe(
      getGroupSortId(targetGroup)
    );
  });

  it('highlights the target group when hovering a task that belongs to another group', () => {
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

    expect(getDashboardDropTargetGroupSortId(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toBe(
      getGroupSortId(targetGroup)
    );
  });

  it('does not highlight the group header when the drop would move the task above the group', () => {
    const group = makeGroup('Target', ['A', 'B'], 0, 1, ['Target']);
    const activeTask = makeTask('A', ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      group,
      activeTask,
      makeTask('B', ['Target']),
    ];
    const orderedTasks = [makeTask('A'), makeTask('B')];

    expect(getDashboardDropTargetGroupSortId(items, getTaskSortId(activeTask), getGroupSortId(group), orderedTasks)).toBeNull();
  });

  it('does not highlight any group for same-group reorders', () => {
    const group = makeGroup('Target', ['A', 'B'], 0, 1, ['Target']);
    const activeTask = makeTask('A', ['Target']);
    const overTask = makeTask('B', ['Target']);
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      group,
      activeTask,
      overTask,
    ];

    expect(getDashboardDropTargetGroupSortId(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toBeNull();
  });

  it('does not highlight when hovering an ungrouped task moves the task to the root', () => {
    const sourceGroup = makeGroup('Source', ['A'], 0, 0, ['Source']);
    const activeTask = makeTask('A', ['Source']);
    const overTask = makeTask('B');
    const items: DashboardItem[] = [
      makeRootGroup(['A', 'B']),
      sourceGroup,
      activeTask,
      overTask,
    ];

    expect(getDashboardDropTargetGroupSortId(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toBeNull();
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
      placement: 'into',
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

  it('moves a grouped task before the first task in its group', () => {
    const group = makeGroup('Target', ['A', 'B', 'C'], 0, 2, ['Target']);
    const activeTask = makeTask('B', ['Target']);
    const overTask = makeTask('A', ['Target']);
    const items: DashboardItem[] = [
      group,
      overTask,
      activeTask,
      makeTask('C', ['Target']),
    ];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toEqual({
      taskIds: ['B'],
      afterTaskId: null,
    });
  });

  it('moves a task to the top of a path group nested under a field group', () => {
    const fieldGroup = makeGroup('Field', ['T1', 'T2', 'T3'], 0, 2, ['Field']);
    const pathGroup = makeGroup('Group', ['T1', 'T2', 'T3'], 0, 2, ['Field', 'Group']);
    const activeTask = makeTask('T2', ['Field', 'Group']);
    const overTask = makeTask('T1', ['Field', 'Group']);
    const items: DashboardItem[] = [
      fieldGroup,
      pathGroup,
      overTask,
      activeTask,
      makeTask('T3', ['Field', 'Group']),
    ];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toEqual({
      taskIds: ['T2'],
      afterTaskId: null,
    });
  });

  it('moves a task to the top of a nested group right below its parent sibling task', () => {
    const parentGroup = makeGroup('Parent', ['P1', 'C1', 'C2'], 0, 2, ['Parent']);
    const childGroup = makeGroup('Child', ['C1', 'C2'], 1, 2, ['Parent', 'Child']);
    const activeTask = makeTask('C2', ['Parent', 'Child']);
    const overTask = makeTask('C1', ['Parent', 'Child']);
    const items: DashboardItem[] = [
      parentGroup,
      makeTask('P1', ['Parent']),
      childGroup,
      overTask,
      activeTask,
    ];
    const orderedTasks = [makeTask('P1'), makeTask('C1'), makeTask('C2')];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toEqual({
      taskIds: ['C2'],
      afterTaskId: 'P1',
    });
    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask), orderedTasks)).toEqual({
      taskIds: ['C2'],
      afterTaskId: 'P1',
    });
  });

  it('anchors a top-of-group move to the underlying neighbor when field grouping re-sorts tasks', () => {
    // Underlying project order: B, A, X — field grouping shows X (k1) before B, A (k2).
    const groupK1 = makeGroup('k1', ['X'], 0, 0, ['k1']);
    const groupK2 = makeGroup('k2', ['B', 'A'], 1, 2, ['k2']);
    const activeTask = makeTask('A', ['k2']);
    const overTask = makeTask('B', ['k2']);
    const items: DashboardItem[] = [
      groupK1,
      makeTask('X', ['k1']),
      groupK2,
      overTask,
      activeTask,
    ];
    const orderedTasks = [makeTask('B'), makeTask('A'), makeTask('X')];

    // Anchoring after visible predecessor X would leave A after B in the
    // underlying order; the plan must instead anchor A directly before B.
    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask), orderedTasks)).toEqual({
      taskIds: ['A'],
      afterTaskId: null,
    });
  });

  it('keeps same-group downward moves anchored to the visible previous task', () => {
    const groupK1 = makeGroup('k1', ['X'], 0, 0, ['k1']);
    const groupK2 = makeGroup('k2', ['B', 'A'], 1, 2, ['k2']);
    const activeTask = makeTask('B', ['k2']);
    const overTask = makeTask('A', ['k2']);
    const items: DashboardItem[] = [
      groupK1,
      makeTask('X', ['k1']),
      groupK2,
      activeTask,
      overTask,
    ];
    const orderedTasks = [makeTask('B'), makeTask('A'), makeTask('X')];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask), orderedTasks)).toEqual({
      taskIds: ['B'],
      afterTaskId: 'A',
    });
  });

  it('moves a task to the end of its group as the closest lower neighbor of the last task', () => {
    const group = makeGroup('Target', ['A', 'B', 'C'], 0, 2, ['Target']);
    const activeTask = makeTask('A', ['Target']);
    const overTask = makeTask('C', ['Target']);
    const items: DashboardItem[] = [
      group,
      activeTask,
      makeTask('B', ['Target']),
      overTask,
    ];
    const orderedTasks = [makeTask('A'), makeTask('B'), makeTask('C')];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask), orderedTasks)).toEqual({
      taskIds: ['A'],
      afterTaskId: 'C',
    });
  });

  it('anchors moves after a collapsed group to that group last child', () => {
    const collapsedGroup: TaskGroupBlock = { ...makeGroup('Closed', ['A', 'B'], 0, 1, ['Closed']), isExpanded: false };
    const activeTask = makeTask('Y');
    const overTask = makeTask('X');
    const items: DashboardItem[] = [
      collapsedGroup,
      overTask,
      activeTask,
    ];

    expect(getVisibleDashboardMovePlan(items, getTaskSortId(activeTask), getTaskSortId(overTask))).toEqual({
      taskIds: ['Y'],
      afterTaskId: 'B',
    });
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
