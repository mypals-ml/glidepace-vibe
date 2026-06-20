import { describe, expect, it } from 'vitest';
import { mapProjectItemToTask } from './githubTaskMapper';
import type { GitHubProjectItem } from '../types';

function makeProjectItem(): GitHubProjectItem {
  return {
    id: 'item-1',
    content: {
      id: 'issue-1',
      __typename: 'Issue',
      title: 'Task with dates',
      number: 1,
      body: '',
      assignees: { nodes: [] },
    },
    fieldValues: {
      nodes: [
        {
          __typename: 'ProjectV2ItemFieldDateValue',
          id: 'date-value-1',
          date: '2026-06-22',
          field: { id: 'live-start-field', name: 'Start date' },
        },
        {
          __typename: 'ProjectV2ItemFieldDateValue',
          id: 'date-value-2',
          date: '2026-06-24',
          field: { id: 'live-target-field', name: 'Target date' },
        },
      ],
    },
  };
}

describe('mapProjectItemToTask', () => {
  it('falls back to named date fields when saved field settings are stale', () => {
    const task = mapProjectItemToTask(makeProjectItem(), {
      startDateFieldId: 'stale-start-field',
      targetDateFieldId: 'stale-target-field',
    });

    expect(task.startDate).toBe('2026-06-22');
    expect(task.targetDate).toBe('2026-06-24');
    expect(task.projectFieldIds?.startDate).toBe('live-start-field');
    expect(task.projectFieldIds?.targetDate).toBe('live-target-field');
    expect(task.tempStartDate).toBeUndefined();
    expect(task.tempTargetDate).toBeUndefined();
  });

  it('reads issue-backed Start/Target date from issueFieldValues when absent from the project item', () => {
    // Org-level issue fields are stored on the issue: they do not appear in the
    // ProjectV2 item fieldValues at all.
    const item: GitHubProjectItem = {
      id: 'item-2',
      content: {
        id: 'issue-2',
        __typename: 'Issue',
        title: 'Issue-backed dates',
        number: 1,
        body: '',
        assignees: { nodes: [] },
        issueFieldValues: {
          nodes: [
            { __typename: 'IssueFieldDateValue', date: '2026-05-27', field: { id: 'IFD_START', name: 'Start date' } },
            { __typename: 'IssueFieldDateValue', date: '2026-05-30', field: { id: 'IFD_TARGET', name: 'Target date' } },
          ],
        },
      },
      fieldValues: { nodes: [] },
    };

    const task = mapProjectItemToTask(item, {});

    expect(task.startDate).toBe('2026-05-27');
    expect(task.targetDate).toBe('2026-05-30');
    // The GitHub value wins, so no calculated temp dates shadow it.
    expect(task.tempStartDate).toBeUndefined();
    expect(task.tempTargetDate).toBeUndefined();
  });

  it('prefers the ProjectV2 item date value over the issue field value', () => {
    const item = makeProjectItem();
    item.content.issueFieldValues = {
      nodes: [
        { __typename: 'IssueFieldDateValue', date: '2000-01-01', field: { id: 'IFD_START', name: 'Start date' } },
      ],
    };

    const task = mapProjectItemToTask(item, {});

    expect(task.startDate).toBe('2026-06-22');
  });
});
