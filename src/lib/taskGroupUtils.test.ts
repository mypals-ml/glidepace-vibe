import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  buildGroupBlocksFromOrderedTasks,
  isTaskGroupBlock,
  parseGroupPath,
  renameGroupBlock,
  serializeGroupPath,
  ungroupGroupBlock,
  parseSlashGroupPath,
  serializeSlashGroupPath,
} from './taskGroupUtils';

function makeTask(id: string, groupPath: string[], startDate = '2026-01-01', targetDate = '2026-01-02'): Task {
  return {
    id,
    displayId: id,
    title: id,
    groupPath,
    startDate,
    targetDate,
    status: 'Todo',
    assignees: [],
    progress: 0,
  };
}

describe('taskGroupUtils', () => {
  it('parses and serializes group paths', () => {
    expect(parseGroupPath('["group1"," group2 "]')).toEqual(['group1', 'group2']);
    expect(parseGroupPath('not json')).toEqual([]);
    expect(parseGroupPath('{"name":"group1"}')).toEqual([]);
    expect(serializeGroupPath(['group1', ' group2 ', ''])).toBe('["group1","group2"]');
  });

  it('parses and serializes slash group paths', () => {
    expect(parseSlashGroupPath('group1 / group2')).toEqual(['group1', 'group2']);
    expect(parseSlashGroupPath('  group1/group2  ')).toEqual(['group1', 'group2']);
    expect(parseSlashGroupPath('')).toEqual([]);
    expect(parseSlashGroupPath(undefined)).toEqual([]);
    expect(serializeSlashGroupPath(['group1', ' group2 ', ''])).toBe('group1 / group2');
    expect(serializeSlashGroupPath([])).toBe('');
    expect(serializeSlashGroupPath(undefined)).toBe('');
  });

  it('creates separate group blocks for separated matching names', () => {
    const items = buildGroupBlocksFromOrderedTasks([
      makeTask('TaskB', ['group1']),
      makeTask('TaskX', []),
      makeTask('TaskC', ['group1', 'group2']),
    ], 'Roadmap');

    const group1Blocks = items
      .filter(isTaskGroupBlock)
      .filter(group => group.name === 'group1');

    expect(group1Blocks).toHaveLength(2);
    expect(group1Blocks.map(group => [group.startTaskIndex, group.endTaskIndex])).toEqual([[0, 0], [2, 2]]);
  });

  it('calculates group dates from the tasks in that block', () => {
    const items = buildGroupBlocksFromOrderedTasks([
      makeTask('TaskA', ['group1'], '2026-02-03', '2026-02-08'),
      makeTask('TaskB', ['group1'], '2026-01-20', '2026-02-01'),
      makeTask('TaskC', [], '2026-03-01', '2026-03-02'),
    ], 'Roadmap');

    const group = items.find(item => isTaskGroupBlock(item) && item.name === 'group1');
    expect(group).toMatchObject({
      startDate: '2026-01-20',
      targetDate: '2026-02-08',
    });
  });

  it('renames only the selected group block', () => {
    const tasks = [
      makeTask('TaskB', ['group1']),
      makeTask('TaskX', []),
      makeTask('TaskC', ['group1', 'group2']),
    ];
    const items = buildGroupBlocksFromOrderedTasks(tasks, 'Roadmap');
    const firstGroup = items.filter(isTaskGroupBlock).find(group => group.name === 'group1' && group.startTaskIndex === 0);

    expect(firstGroup).toBeDefined();
    const renamed = renameGroupBlock(tasks, firstGroup!, 'alpha');

    expect(renamed.map(task => task.groupPath)).toEqual([
      ['alpha'],
      [],
      ['group1', 'group2'],
    ]);
  });

  it('ungroups only the selected group block', () => {
    const tasks = [
      makeTask('TaskA', ['group1', 'group2']),
      makeTask('TaskB', ['group1', 'group2', 'group3']),
      makeTask('TaskX', []),
    ];
    const items = buildGroupBlocksFromOrderedTasks(tasks, 'Roadmap');
    const group2 = items.filter(isTaskGroupBlock).find(group => group.name === 'group2');

    expect(group2).toBeDefined();
    const ungrouped = ungroupGroupBlock(tasks, group2!);

    expect(ungrouped.map(task => task.groupPath)).toEqual([
      ['group1'],
      ['group1', 'group3'],
      [],
    ]);
  });
});
