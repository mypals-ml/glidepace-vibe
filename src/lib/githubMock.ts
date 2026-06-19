import type { Task, TaskComment, TaskStatus, GitHubProjectV2Field } from '../types';
import { logDashboardEvent } from './dashboardDebugLog';
import {
  MOCK_FIELD_IDS,
  MOCK_PROJECTS_DATA,
  MOCK_PROJECT_TASKS_MAP,
  MOCK_STATUS_OPTIONS,
  MOCK_TASKS,
  MOCK_USER_POOL,
} from './githubMockData';

export {
  MOCK_ACCOUNTS_DATA,
  MOCK_PROJECTS_DATA,
  MOCK_STATUS_OPTIONS,
  MOCK_TOKEN,
  MOCK_USER_POOL,
} from './githubMockData';

type MockFieldValueInput = {
  singleSelectOptionId?: string;
  date?: string;
  number?: number;
  text?: string;
};

function getTextFieldValue(task: Task, field: GitHubProjectV2Field): string {
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

function applyMockFieldValue(task: Task, field: GitHubProjectV2Field | undefined, value: MockFieldValueInput) {
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
function mapTaskToGraphQLNode(task: Task, projectId = 'PVT_1', includeComments = false) {
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
const MOCK_PROJECT_FIELDS_MAP: Record<string, GitHubProjectV2Field[]> = {};

function getFieldsForProject(projectId: string) {
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

function getTasksForProject(projectId: string): Task[] {
  if (!MOCK_PROJECT_TASKS_MAP[projectId]) {
    // Initialize other projects with a copy of the default MOCK_TASKS
    MOCK_PROJECT_TASKS_MAP[projectId] = [...MOCK_TASKS];
  }
  return MOCK_PROJECT_TASKS_MAP[projectId];
}

function getAllMockTasks(): Task[] {
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

  // Helper to extract variables that might be flat or nested in 'input'
  const getVar = (key: string) => {
    const v = variables as Record<string, unknown>;
    const i = (variables.input || {}) as Record<string, unknown>;
    const val = v[key] ?? i[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return val as any;
  };

  if (query.includes('organization(') && query.includes('membersWithRole')) {
    // Mock Org Members fetch
    return {
      data: {
        organization: {
          membersWithRole: {
            nodes: MOCK_USER_POOL.map(u => ({
              __typename: 'User',
              id: u.id,
              login: u.login,
              name: u.name,
              avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`
            }))
          }
        }
      }
    };
  }

  if (query.includes('projectsV2') && !query.includes('items')) {
    // List projects
    return {
      data: {
        viewer: {
          login: 'octocat',
          databaseId: 12345,
          projectsV2: {
            nodes: MOCK_PROJECTS_DATA[0].projects
          },
          organizations: { nodes: [] }
        }
      }
    };
  }

  if (query.includes('repository(') && query.includes('assignableUsers')) {
    const searchTerm = variables.query || '';
    const results = MOCK_USER_POOL.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(u => ({
      __typename: 'User',
      id: u.id,
      login: u.login,
      name: u.name,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`
    }));

    return {
      data: {
        repository: {
          assignableUsers: {
            nodes: results
          }
        }
      }
    };
  }

  if (query.includes('search(query:') && query.includes('type: USER')) {
    const searchTerm = (variables.searchQuery || variables.query || '').split(' ').pop() || '';
    const results = MOCK_USER_POOL.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(u => ({
      __typename: 'User',
      id: u.id,
      login: u.login,
      name: u.name,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`
    }));

    return {
      data: {
        search: {
          nodes: results
        }
      }
    };
  }

  if (query.includes('updateProjectV2ItemPosition(')) {
    const projectId = getVar('projectId');
    const itemId = getVar('itemId');
    const afterId = getVar('afterId') as string | null | undefined;
    if (!projectId || !itemId) return { errors: [{ message: 'ProjectId and itemId are required' }] };

    const projectTasks = getTasksForProject(projectId);
    const currentIndex = projectTasks.findIndex(task => task.itemId === itemId || task.id === itemId);
    if (currentIndex === -1) return { errors: [{ message: 'Item not found' }] };

    logDashboardEvent('[GitHubMock] Reorder action', {
      reorderKind: 'project_item_position',
      projectId,
      itemId,
      afterId: afterId ?? null,
      itemCount: projectTasks.length,
    });

    const [movedTask] = projectTasks.splice(currentIndex, 1);
    if (afterId === null || afterId === undefined) {
      projectTasks.unshift(movedTask);
    } else {
      const afterIndex = projectTasks.findIndex(task => task.itemId === afterId || task.id === afterId);
      if (afterIndex === -1) {
        projectTasks.splice(currentIndex, 0, movedTask);
        return { errors: [{ message: 'After item not found' }] };
      }
      projectTasks.splice(afterIndex + 1, 0, movedTask);
    }

    return {
      data: {
        updateProjectV2ItemPosition: {
          items: {
            nodes: projectTasks.slice(0, 1).map(task => ({ id: task.itemId }))
          }
        }
      }
    };
  }

  if (query.includes('items')) {
    // List project tasks
    const projectId = variables.projectId || 'PVT_1';
    const projectTasks = getTasksForProject(projectId);
    logDashboardEvent('[GitHubMock] Refresh action', {
      refreshKind: 'project_items',
      projectId,
      refreshedItemCount: projectTasks.length,
    });
    return {
      data: {
        node: {
          public: projectId === 'PVT_2' ? false : true,
          fields: {
            nodes: getFieldsForProject(projectId)
          },
          items: {
            nodes: projectTasks.map(task => mapTaskToGraphQLNode(task, projectId))
          }
        }
      }
    };
  }

  if (query.includes('comments(first: 30')) {
    const nodeId = variables.nodeId || getVar('nodeId');
    const task = getAllMockTasks().find(t => t.contentId === nodeId || t.itemId === nodeId || t.id === nodeId);
    if (!task) return { errors: [{ message: 'Node not found' }] };

    const cursor = variables.cursor || getVar('cursor');
    const first = 30;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + first;
    const paginatedComments = (task.comments || []).slice(startIndex, endIndex);
    const hasNextPage = (task.comments || []).length > endIndex;
    const endCursor = hasNextPage ? String(endIndex) : null;

    return {
      data: {
        node: {
          __typename: task.isDraft ? 'DraftIssue' : 'Issue',
          id: nodeId,
          comments: {
            pageInfo: {
              hasNextPage,
              endCursor
            },
            nodes: paginatedComments.map(c => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt,
              author: {
                login: c.author.login || c.author.id,
                avatarUrl: c.author.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author.name)}&background=random`,
                name: c.author.name
              }
            }))
          }
        }
      }
    };
  }

  if (query.includes('node(id: $itemId)')) {
    // Fetch single item
    const itemId = variables.itemId;
    const task = getAllMockTasks().find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Node not found' }] };
    const projectId = variables.projectId || Object.keys(MOCK_PROJECT_TASKS_MAP).find(id => getTasksForProject(id).some(t => t.itemId === itemId));

    return {
      data: {
        node: mapTaskToGraphQLNode(task, projectId)
      }
    };
  }

  if (query.includes('updateIssue(')) {
    const issueId = getVar('id') || getVar('issueId');
    const task = getAllMockTasks().find(t => t.contentId === issueId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    const title = getVar('title');
    const body = getVar('body');
    const assigneeIds = getVar('assigneeIds');

    if (title !== undefined) task.title = title;
    if (body !== undefined) task.body = body;
    if (assigneeIds !== undefined) {
      task.assignees = MOCK_USER_POOL.filter(u => assigneeIds.includes(u.id));
    }

    return { data: { updateIssue: { issue: { id: task.contentId } } } };
  }

  if (query.includes('addAssigneesToAssignable(')) {
    const issueId = getVar('assignableId') || getVar('issueId');
    const assigneeIds = getVar('assigneeIds') || [];
    const task = getAllMockTasks().find(t => t.contentId === issueId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    const newAssignees = MOCK_USER_POOL.filter(u => assigneeIds.includes(u.id));
    newAssignees.forEach(u => {
      if (!task.assignees.some(a => a.id === u.id)) {
        task.assignees.push(u);
      }
    });

    return { 
      data: { 
        addAssigneesToAssignable: { 
          assignable: { 
            id: task.contentId,
            assignees: {
              nodes: task.assignees.map(a => ({
                __typename: 'User',
                id: a.id,
                login: a.login || a.id,
                name: a.name,
                avatarUrl: a.avatarUrl
              }))
            }
          } 
        } 
      } 
    };
  }

  if (query.includes('removeAssigneesFromAssignable(')) {
    const issueId = getVar('assignableId') || getVar('issueId');
    const assigneeIds = getVar('assigneeIds') || [];
    const task = getAllMockTasks().find(t => t.contentId === issueId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    task.assignees = task.assignees.filter(a => !assigneeIds.includes(a.id));

    return { 
      data: { 
        removeAssigneesFromAssignable: { 
          assignable: { 
            id: task.contentId,
            assignees: {
              nodes: task.assignees.map(a => ({
                __typename: 'User',
                id: a.id,
                login: a.login || a.id,
                name: a.name,
                avatarUrl: a.avatarUrl
              }))
            }
          } 
        } 
      } 
    };
  }

  if (query.includes('updateIssueComment(')) {
    const commentId = getVar('id');
    const body = getVar('body');
    const allTasks = getAllMockTasks();
    for (const task of allTasks) {
      const comment = task.comments?.find(c => c.id === commentId);
      if (comment && body !== undefined) {
        comment.body = body;
        return { data: { updateIssueComment: { issueComment: { id: commentId } } } };
      }
    }
    return { errors: [{ message: 'Comment not found' }] };
  }

  if (query.includes('deleteIssueComment(')) {
    const commentId = getVar('id');
    const allTasks = getAllMockTasks();
    for (const task of allTasks) {
      if (task.comments) {
        const commentIndex = task.comments.findIndex(c => c.id === commentId);
        if (commentIndex !== -1) {
          task.comments.splice(commentIndex, 1);
          return { data: { deleteIssueComment: { clientMutationId: null } } };
        }
      }
    }
    return { errors: [{ message: 'Comment not found' }] };
  }

  if (query.includes('addComment(')) {
    const subjectId = getVar('subjectId');
    const body = getVar('body');
    const task = getAllMockTasks().find(t => t.contentId === subjectId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    const newComment: TaskComment = {
      id: `comment-${task.id.replace('#', '')}-${(task.comments || []).length + 1}`,
      author: MOCK_USER_POOL[0], // Alex Rivera
      body: body || '',
      createdAt: new Date().toISOString(),
    };

    if (!task.comments) task.comments = [];
    task.comments.push(newComment);

    return {
      data: {
        addComment: {
          commentEdge: {
            node: {
              id: newComment.id,
              body: newComment.body,
              createdAt: newComment.createdAt,
              author: {
                __typename: 'User',
                login: newComment.author.id,
                name: newComment.author.name,
                avatarUrl: newComment.author.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(newComment.author.name)}&background=random`
              }
            }
          }
        }
      }
    };
  }

  if (query.includes('addProjectV2DraftIssue(')) {
    const projectId = getVar('projectId');
    const title = getVar('title');
    const body = getVar('body');
    
    if (!projectId) return { errors: [{ message: 'ProjectId is required' }] };

    const projectTasks = getTasksForProject(projectId);
    const newId = projectTasks.length + 501; // Start high for draft issues
    
    const newTask: Task = {
      id: `item-${newId}`,
      displayId: `#${newId}`,
      itemId: `item-${newId}`,
      contentId: `content-${newId}`,
      title: title || 'New Task',
      body: body || '',
      status: 'Todo',
      startDate: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      targetDate: new Date(Date.now() + 86400000 * 2).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      groupPath: [],
      assignees: [],
      progress: 0,
      comments: [],
    };

    projectTasks.push(newTask); // Add to bottom (real project behavior)

    return {
      data: {
        addProjectV2DraftIssue: {
          projectItem: {
            id: newTask.itemId
          }
        }
      }
    };
  }

  if (query.includes('deleteProjectV2Item(')) {
    const projectId = getVar('projectId');
    const itemId = getVar('itemId');
    if (!projectId || !itemId) return { errors: [{ message: 'ProjectId and itemId are required' }] };

    const projectTasks = getTasksForProject(projectId);
    const itemIndex = projectTasks.findIndex(task => task.itemId === itemId || task.id === itemId);
    if (itemIndex === -1) return { errors: [{ message: 'Item not found' }] };

    projectTasks.splice(itemIndex, 1);
    return { data: { deleteProjectV2Item: { deletedItemId: itemId } } };
  }

  if (query.includes('deleteIssue(')) {
    const issueId = getVar('issueId');
    const task = getAllMockTasks().find(t => t.contentId === issueId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    task.contentId = undefined;
    return { data: { deleteIssue: { repository: { id: 'mock-repository-id' } } } };
  }

  // Aliased batch field update (batchUpdateProjectV2ItemFields). Detected by the
  // generated operation name; applies each indexed set/clear in order.
  if (query.includes('mutation BatchUpdateFields')) {
    const projectId = getVar('projectId');
    const itemId = getVar('itemId');
    const task = getAllMockTasks().find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Item not found' }] };

    const fields = projectId ? getFieldsForProject(projectId) : Object.values(MOCK_PROJECT_FIELDS_MAP).flat();
    const data: Record<string, unknown> = {};
    let i = 0;
    while (variables[`fieldId${i}`] !== undefined) {
      const fieldId = variables[`fieldId${i}`] as string;
      const field = fields.find(f => f.id === fieldId);
      const value = variables[`value${i}`];
      if (value !== undefined) {
        applyMockFieldValue(task, field, value as MockFieldValueInput);
        data[`u${i}`] = { projectV2Item: { id: task.itemId } };
      } else {
        // Clear branch
        const fieldName = field?.name.toLowerCase() || '';
        if (field?.id === MOCK_FIELD_IDS.startDate || fieldName.includes('start')) {
          task.startDate = '';
          task.fullStartDate = undefined;
          task.tempStartDate = undefined;
          task.tempTargetDate = undefined;
        }
        data[`c${i}`] = { projectV2Item: { id: task.itemId } };
      }
      i++;
    }
    return { data };
  }

  if (query.includes('updateProjectV2ItemFieldValue(')) {
    const projectId = getVar('projectId');
    const itemId = getVar('itemId');
    const task = getAllMockTasks().find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Item not found' }] };

    const value = getVar('value');
    const fieldId = getVar('fieldId');
    const fields = projectId ? getFieldsForProject(projectId) : Object.values(MOCK_PROJECT_FIELDS_MAP).flat();
    const field = fields.find(f => f.id === fieldId);
    applyMockFieldValue(task, field, value || {});

    return { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: task.itemId } } } };
  }

  if (query.includes('clearProjectV2ItemFieldValue(')) {
    const projectId = getVar('projectId');
    const itemId = getVar('itemId');
    const task = getAllMockTasks().find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Item not found' }] };

    const fieldId = getVar('fieldId');
    const fields = projectId ? getFieldsForProject(projectId) : Object.values(MOCK_PROJECT_FIELDS_MAP).flat();
    const field = fields.find(f => f.id === fieldId);
    const fieldName = field?.name.toLowerCase() || '';
    if (field?.id === MOCK_FIELD_IDS.startDate || fieldName.includes('start')) {
      task.startDate = '';
      task.fullStartDate = undefined;
      task.tempStartDate = undefined;
      task.tempTargetDate = undefined;
    }

    return { data: { clearProjectV2ItemFieldValue: { projectV2Item: { id: task.itemId } } } };
  }

  if (query.includes('createProjectV2Field(')) {
    const projectId = getVar('projectId');
    const name = getVar('name');
    const dataType = getVar('dataType');

    const newField = {
      __typename: 'ProjectV2Field',
      id: `mock-created-${name.toLowerCase().replace(/\s+/g, '-')}-id`,
      name,
      dataType
    };

    if (projectId) {
      const fields = getFieldsForProject(projectId);
      fields.push(newField);
    }

    return {
      data: {
        createProjectV2Field: {
          projectV2Field: newField
        }
      }
    };
  }

  return { errors: [{ message: 'Mock query not implemented' }] };
}
