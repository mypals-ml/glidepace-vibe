import type { Task, TaskStatus, GitHubProjectV2Field } from '../types';
import {
  MOCK_FIELD_IDS,
  MOCK_PROJECT_TASKS_MAP,
  MOCK_STATUS_OPTIONS,
  MOCK_TASKS,
} from './githubMockData';
import { handleMockOperation } from './githubMockHandlers';

export {
  MOCK_ACCOUNTS_DATA,
  MOCK_PROJECTS_DATA,
  MOCK_STATUS_OPTIONS,
  MOCK_TOKEN,
  MOCK_USER_POOL,
} from './githubMockData';

export type MockFieldValueInput = {
  singleSelectOptionId?: string;
  date?: string;
  number?: number;
  text?: string;
};

export function getTextFieldValue(task: Task, field: GitHubProjectV2Field): string {
  const fieldName = field.name.toLowerCase();
  if (field.id === MOCK_FIELD_IDS.successor || fieldName.includes('successor')) {
    return (task.successorIds || []).join(',');
  }
  if (field.id === MOCK_FIELD_IDS.predecessor || fieldName.includes('predecessor')) {
    return (task.predecessorIds || []).join(',');
  }
  if (field.id === MOCK_FIELD_IDS.groupPath || fieldName.includes('group path') || fieldName === 'group') {
    return JSON.stringify(task.groupPath || []);
  }
  if (fieldName.includes('auto') && fieldName.includes('start')) {
    return task.autoUpdateStartDate || 'ask';
  }
  if (fieldName.includes('unit') || fieldName.includes('category')) {
    return task.estimateUnit || task.tempEstimateUnit || 'days';
  }
  return '';
}

export function applyMockFieldValue(task: Task, field: GitHubProjectV2Field | undefined, value: MockFieldValueInput) {
  if (!field) return;

  const fieldName = field.name.toLowerCase();

  if (value.singleSelectOptionId) {
    if (field.id === MOCK_FIELD_IDS.status || fieldName === 'status') {
      const matched = MOCK_STATUS_OPTIONS.find(o => o.id === value.singleSelectOptionId);
      if (matched) {
        task.status = matched.name as TaskStatus;
        task.progress = task.status === 'Done' ? 100 : (task.status === 'In Progress' ? 50 : 0);
      }
    } else if (fieldName.includes('unit') || fieldName.includes('category')) {
      const matched = field.options?.find(o => o.id === value.singleSelectOptionId);
      if (matched) task.estimateUnit = matched.name;
    }
  }

  if (value.date) {
    if (field.id === MOCK_FIELD_IDS.startDate || fieldName.includes('start')) {
      task.fullStartDate = value.date;
      task.startDate = new Date(value.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (field.id === MOCK_FIELD_IDS.targetDate || fieldName.includes('target') || fieldName.includes('end')) {
      task.fullTargetDate = value.date;
      task.targetDate = new Date(value.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  if (value.number !== undefined) {
    if (field.id === MOCK_FIELD_IDS.estimate || fieldName.includes('estimate') || fieldName.includes('duration')) {
      task.estimate = value.number;
    }
  }

  if (value.text !== undefined) {
    if (field.id === MOCK_FIELD_IDS.successor || fieldName.includes('successor')) {
      task.successorIds = value.text.split(',').map(s => s.trim()).filter(Boolean);
    } else if (field.id === MOCK_FIELD_IDS.predecessor || fieldName.includes('predecessor')) {
      task.predecessorIds = value.text.split(',').map(s => s.trim()).filter(Boolean);
    } else if (field.id === MOCK_FIELD_IDS.groupPath || fieldName.includes('group path') || fieldName === 'group') {
      try {
        const parsed = JSON.parse(value.text);
        task.groupPath = Array.isArray(parsed)
          ? parsed.filter((segment): segment is string => typeof segment === 'string').map(segment => segment.trim()).filter(Boolean)
          : [];
      } catch {
        task.groupPath = [];
      }
    } else if (fieldName.includes('auto') && fieldName.includes('start')) {
      if (value.text === 'auto' || value.text === 'locked' || value.text === 'ask') {
        task.autoUpdateStartDate = value.text;
      }
    } else if (fieldName.includes('unit') || fieldName.includes('category')) {
      task.estimateUnit = value.text;
    }
  }
}

// Helper to map tasks back to GitHub GraphQL nodes
export function mapTaskToGraphQLNode(task: Task, projectId = 'PVT_1', includeComments = false) {
  const matchedOption = MOCK_STATUS_OPTIONS.find(o => o.name === task.status)
    ?? MOCK_STATUS_OPTIONS[0];

  const statusField = {
    __typename: 'ProjectV2ItemFieldSingleSelectValue',
    name: matchedOption.name,
    optionId: matchedOption.id,
    field: {
      __typename: 'ProjectV2SingleSelectField',
      id: MOCK_FIELD_IDS.status,
      name: 'Status',
      options: MOCK_STATUS_OPTIONS,   // ← enables mapProjectItemToTask to read all options
    },
  };
  const startDateField = {
    __typename: 'ProjectV2ItemFieldDateValue',
    date: task.fullStartDate || new Date().toISOString(),
    field: { __typename: 'ProjectV2Field', id: MOCK_FIELD_IDS.startDate, name: 'Start Date' },
  };
  const targetDateField = {
    __typename: 'ProjectV2ItemFieldDateValue',
    date: task.fullTargetDate || new Date().toISOString(),
    field: { __typename: 'ProjectV2Field', id: MOCK_FIELD_IDS.targetDate, name: 'Target Date' },
  };
  const customFieldValues = getFieldsForProject(projectId)
    .filter(field => ![MOCK_FIELD_IDS.status, MOCK_FIELD_IDS.startDate, MOCK_FIELD_IDS.targetDate].includes(field.id))
    .map(field => {
      if (field.__typename === 'ProjectV2SingleSelectField') {
        const selectedName = getTextFieldValue(task, field);
        const selectedOption = field.options?.find(option => option.name === selectedName) || field.options?.[0];
        return {
          __typename: 'ProjectV2ItemFieldSingleSelectValue',
          name: selectedOption?.name || '',
          optionId: selectedOption?.id || '',
          field,
        };
      }

      if (field.dataType === 'NUMBER') {
        return {
          __typename: 'ProjectV2ItemFieldNumberValue',
          number: task.estimate,
          field,
        };
      }

      return {
        __typename: 'ProjectV2ItemFieldTextValue',
        text: getTextFieldValue(task, field),
        field,
      };
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentNode: any = {
    id: task.contentId,
    title: task.title,
    number: parseInt(task.id.replace('#', '') || '1'),
    state: task.status === 'Done' ? 'CLOSED' : 'OPEN',
    body: task.body || '',
    repository: { nameWithOwner: 'glidepace/glidelines' },
    assignees: {
      nodes: task.assignees.map(a => ({
        __typename: 'User',
        id: a.id,
        login: a.id === 'u1' ? 'arivera' : (a.id === 'u2' ? 'jsmith' : (a.id === 'u3' ? 'cchen' : (a.id === 'u4' ? 'treed' : (a.id === 'u5' ? 'mlee' : 'unknown')))),
        name: a.name,
        avatarUrl: a.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=random`
      }))
    }
  };

  if (includeComments) {
    contentNode.comments = {
      nodes: (task.comments || []).map(c => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: {
          __typename: 'User',
          login: c.author.id,
          name: c.author.name,
          avatarUrl: c.author.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author.name)}&background=random`
        }
      }))
    };
  }

  return {
    id: task.itemId,
    content: contentNode,
    fieldValues: {
      nodes: [statusField, startDateField, targetDateField, ...customFieldValues]
    }
  };
}

// ---------------------------------------------------------------------------
// Per-project field storage for in-memory persistence during the session
// ---------------------------------------------------------------------------
export const MOCK_PROJECT_FIELDS_MAP: Record<string, GitHubProjectV2Field[]> = {};
export const MOCK_PROJECT_READMES_MAP: Record<string, string> = {};

export function getFieldsForProject(projectId: string) {
  if (!MOCK_PROJECT_FIELDS_MAP[projectId]) {
    // Default fields for any project
    MOCK_PROJECT_FIELDS_MAP[projectId] = [
      {
        __typename: 'ProjectV2SingleSelectField',
        id: MOCK_FIELD_IDS.status,
        name: 'Status',
        options: MOCK_STATUS_OPTIONS
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.startDate,
        name: 'Start Date',
        dataType: 'DATE'
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.targetDate,
        name: 'Target Date',
        dataType: 'DATE'
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.estimate,
        name: 'Estimate',
        dataType: 'NUMBER'
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.successor,
        name: 'Successors',
        dataType: 'TEXT'
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.predecessor,
        name: 'Predecessors',
        dataType: 'TEXT'
      },
      {
        __typename: 'ProjectV2Field',
        id: MOCK_FIELD_IDS.groupPath,
        name: 'Group Path',
        dataType: 'TEXT'
      }
    ];

    // Some projects have a unit field already
    if (projectId === 'PVT_1' || projectId === 'PVT_3') {
      MOCK_PROJECT_FIELDS_MAP[projectId].push({
        __typename: 'ProjectV2Field',
        id: 'mock-unit-id',
        name: 'Estimate Category',
        dataType: 'TEXT'
      });
    }
  }
  return MOCK_PROJECT_FIELDS_MAP[projectId];
}

export function getTasksForProject(projectId: string): Task[] {
  if (!MOCK_PROJECT_TASKS_MAP[projectId]) {
    // Initialize other projects with a copy of the default MOCK_TASKS
    MOCK_PROJECT_TASKS_MAP[projectId] = [...MOCK_TASKS];
  }
  return MOCK_PROJECT_TASKS_MAP[projectId];
}

export function getAllMockTasks(): Task[] {
  const all: Task[] = [];
  Object.values(MOCK_PROJECT_TASKS_MAP).forEach(list => all.push(...list));
  // Also include base MOCK_TASKS just in case
  all.push(...MOCK_TASKS);
  return all;
}

export interface MockVariables {
  projectId?: string;
  itemId?: string;
  issueId?: string;
  subjectId?: string;
  body?: string;
  fieldId?: string;
  afterId?: string | null;
  value?: MockFieldValueInput;
  input?: {
    id?: string;
    itemId?: string;
    subjectId?: string;
    fieldId?: string;
    assignableId?: string;
    title?: string;
    body?: string;
    assigneeIds?: string[];
    value?: {
      singleSelectOptionId?: string;
      date?: string;
      number?: number;
      text?: string;
    };
    afterId?: string | null;
  };
  assignableId?: string;
  assigneeIds?: string[];
  query?: string;
  searchQuery?: string;
  nodeId?: string;
  cursor?: string | null;
  // Aliased batch field mutation variables: fieldId0/value0, fieldId1/value1, …
  [key: string]: unknown;
}

export async function handleMockGraphQL(query: string, variables: MockVariables) {
  console.log('[MockAPI] Handling GraphQL query:', { query: query.substring(0, 100) + '...', variables });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return handleMockOperation(query, variables);
}
