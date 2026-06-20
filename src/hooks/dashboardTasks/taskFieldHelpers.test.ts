import { describe, it, expect } from 'vitest';
import {
  uniqueTasks,
  getProjectFixedStartDateMode,
  preserveUniqueIds,
  getExistingPredecessorIds,
  findProjectFieldId,
  getProjectFieldUpdateValue,
  applyTaskFieldValueChanges,
} from './taskFieldHelpers';
import type { Task, ProjectDateSettings, GitHubProjectV2Field } from '../../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    displayId: '1',
    title: 'Task 1',
    status: 'Todo',
    startDate: '',
    targetDate: '',
    estimate: 0,
    assignees: [],
    progress: 0,
    ...overrides,
  } as Task;
}

describe('uniqueTasks', () => {
  it('removes duplicate tasks by itemId or id, keeping the first occurrence', () => {
    const a = makeTask({ id: 'a', itemId: 'item-a' });
    const aDup = makeTask({ id: 'a2', itemId: 'item-a' });
    const b = makeTask({ id: 'b' });
    const bDup = makeTask({ id: 'b' });

    const result = uniqueTasks([a, aDup, b, bDup]);

    expect(result).toEqual([a, b]);
  });
});

describe('getProjectFixedStartDateMode', () => {
  it('returns the configured mode', () => {
    const settings = { fixedSuccessorStartDateMode: 'auto' } as ProjectDateSettings;
    expect(getProjectFixedStartDateMode(settings)).toBe('auto');
  });

  it('falls back to ask when unset', () => {
    expect(getProjectFixedStartDateMode({} as ProjectDateSettings)).toBe('ask');
  });
});

describe('preserveUniqueIds', () => {
  it('drops falsy entries and deduplicates while preserving order', () => {
    expect(preserveUniqueIds(['a', '', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });
});

describe('findProjectFieldId', () => {
  const fields: GitHubProjectV2Field[] = [
    { __typename: 'ProjectV2Field', id: 'title-field', name: 'Title', dataType: 'TITLE' },
    { __typename: 'ProjectV2Field', id: 'start-field', name: 'Start date', dataType: 'DATE' },
    { __typename: 'ProjectV2SingleSelectField', id: 'unit-field', name: 'Estimate Unit', dataType: 'SINGLE_SELECT' },
  ];

  it('finds a field by name and type constraints', () => {
    expect(findProjectFieldId(fields, {
      names: ['start'],
      dataTypes: ['DATE'],
      typenames: ['ProjectV2Field'],
    })).toBe('start-field');
  });

  it('returns undefined when the type does not match', () => {
    expect(findProjectFieldId(fields, {
      names: ['start'],
      dataTypes: ['NUMBER'],
      typenames: ['ProjectV2Field'],
    })).toBeUndefined();
  });
});

describe('getExistingPredecessorIds', () => {
  it('returns the explicit predecessorIds when present', () => {
    const successor = makeTask({ id: 's', predecessorIds: ['p1', 'p2'] });
    expect(getExistingPredecessorIds([], successor)).toEqual(['p1', 'p2']);
  });

  it('derives predecessors from other tasks successorIds when missing', () => {
    const successor = makeTask({ id: 's', itemId: 'item-s' });
    const pred = makeTask({ id: 'p', itemId: 'item-p', successorIds: ['item-s'] });
    const unrelated = makeTask({ id: 'u', itemId: 'item-u', successorIds: ['item-x'] });

    expect(getExistingPredecessorIds([pred, unrelated, successor], successor)).toEqual(['item-p']);
  });
});

describe('getProjectFieldUpdateValue', () => {
  const field = {
    id: 'f1',
    name: 'Status',
    options: [{ id: 'opt-1', name: 'Done' }],
  } as GitHubProjectV2Field;

  it('returns a singleSelectOptionId payload when the option exists', () => {
    expect(getProjectFieldUpdateValue(field, 'Done')).toEqual({ singleSelectOptionId: 'opt-1' });
  });

  it('falls back to a text payload when the option is unknown', () => {
    expect(getProjectFieldUpdateValue(field, 'Unknown')).toEqual({ text: 'Unknown' });
    expect(getProjectFieldUpdateValue(undefined, 'Anything')).toEqual({ text: 'Anything' });
  });
});

describe('applyTaskFieldValueChanges', () => {
  it('returns the same task when there are no changes', () => {
    const task = makeTask();
    expect(applyTaskFieldValueChanges(task, [])).toBe(task);
  });

  it('writes field values into projectFieldValues', () => {
    const task = makeTask({ projectFieldValues: { existing: 'x' } });
    const result = applyTaskFieldValueChanges(task, [{ fieldId: 'f2', value: 'hello' }]);

    expect(result.projectFieldValues).toEqual({ existing: 'x', f2: 'hello' });
    expect(result.status).toBe('Todo');
  });

  it('updates status and progress when the status field changes', () => {
    const task = makeTask({
      projectFieldIds: { status: 'status-field' },
    });

    const done = applyTaskFieldValueChanges(task, [{ fieldId: 'status-field', value: 'Done' }]);
    expect(done.status).toBe('Done');
    expect(done.progress).toBe(100);

    const todo = applyTaskFieldValueChanges(task, [{ fieldId: 'status-field', value: 'Todo' }]);
    expect(todo.status).toBe('Todo');
    expect(todo.progress).toBe(0);

    const inProgress = applyTaskFieldValueChanges(task, [{ fieldId: 'status-field', value: 'In progress' }]);
    expect(inProgress.status).toBe('In progress');
    expect(inProgress.progress).toBe(50);
  });
});
