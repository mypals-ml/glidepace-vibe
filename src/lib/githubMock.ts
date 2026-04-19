import type { ProjectOwnerInfo, Task, TaskComment, TaskStatus } from '../types';

// ---------------------------------------------------------------------------
// Mock status options — mirrors the `ProjectV2SingleSelectField.options` shape
// from the real GitHub GraphQL API so that mapProjectItemToTask can extract
// them just like a real project.
// ---------------------------------------------------------------------------
export const MOCK_STATUS_OPTIONS: { id: string; name: string; color: string }[] = [
  { id: 'opt-todo', name: 'Todo', color: 'GRAY' },
  { id: 'opt-inprogress', name: 'In Progress', color: 'YELLOW' },
  { id: 'opt-done', name: 'Done', color: 'PURPLE' },
];

// Stable field IDs used by the mock so that projectFieldIds round-trips work.
const MOCK_FIELD_IDS = {
  status: 'mock-status-field-id',
  startDate: 'mock-start-date-id',
  endDate: 'mock-end-date-id',
};

export const MOCK_TOKEN = 'mock-token-123';
export const DUMMY_PROJECT_ID = 'PVT_DUMMY_123';

export const MOCK_ACCOUNTS_DATA = [
  { id: 'mock-1', login: 'glidelines-demo', name: 'Glidelines Demo', avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4', token: MOCK_TOKEN },
];

export const MOCK_PROJECTS_DATA: ProjectOwnerInfo[] = [
  {
    login: 'glidelines-demo',
    isOrg: false,
    projects: [
      { id: DUMMY_PROJECT_ID, title: 'Demo: Product Roadmap 2024', public: true },
      { id: 'PVT_2', title: 'Demo: Bug Tracker', public: false },
      { id: 'PVT_3', title: 'Connected GitHub Tasks', public: true },
      { id: 'PVT_EMPTY', title: 'Empty Project Demo', public: true },
    ],
  },
];

// Sample task descriptions and comments
const taskDescriptions = [
  'Implement a responsive UI component that works across all device sizes. Should include proper accessibility features and follow WCAG standards.',
  'Investigate and fix the slow query causing 2+ second load times. Consider indexing strategy and query optimization techniques.',
  'Update README and API documentation to reflect the latest changes. Include examples and use cases.',
  'Optimize the database query that is running in O(n²) time. Target is to reduce to O(n log n).',
  'Refactor authentication layer to support OAuth2 and JWT tokens. Ensure backward compatibility with existing auth methods.',
  'Add comprehensive unit and integration tests for the new payment processing module. Aim for 80%+ code coverage.',
  'Design the new feature dashboard layout in Figma. Include mobile and desktop considerations.',
  'Deploy the release candidate to production. Include monitoring setup and rollback plan.'
];

const commentTemplates = [
  { author: 'Alex Rivera', comment: 'Started working on this, should have initial implementation by end of day.' },
  { author: 'Jordan Smith', comment: 'Great progress! I reviewed the code and left some minor suggestions on the PR.' },
  { author: 'Casey Chen', comment: 'Need help with the testing strategy here. Can we pair on this tomorrow?' },
  { author: 'Taylor Reed', comment: 'All tests are passing now in the CI pipeline. Ready for review.' },
  { author: 'Morgan Lee', comment: 'Looks good! I had one concern about error handling, but overall impressed with the implementation.' },
  { author: 'Alex Rivera', comment: 'Merged to main. Let\'s monitor performance metrics in production.' },
  { author: 'Jordan Smith', comment: 'Users are reporting positive feedback on the new UI. Great job team!' },
  { author: 'Casey Chen', comment: 'Just deployed the latest version. No issues in beta testing.' },
];

export const MOCK_USER_POOL = [
  { id: 'u1', login: 'arivera', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
  { id: 'u2', login: 'jsmith', name: 'Jordan Smith', initials: 'JS', avatarColor: 'bg-indigo-100 text-indigo-700' },
  { id: 'u3', login: 'cchen', name: 'Casey Chen', initials: 'CC', avatarColor: 'bg-emerald-100 text-emerald-700' },
  { id: 'u4', login: 'treed', name: 'Taylor Reed', initials: 'TR', avatarColor: 'bg-rose-100 text-rose-700' },
  { id: 'u5', login: 'mlee', name: 'Morgan Lee', initials: 'ML', avatarColor: 'bg-purple-100 text-purple-700' },
  { id: 'u6', login: 'jvarga', name: 'Jamie Varga', initials: 'JV', avatarColor: 'bg-cyan-100 text-cyan-700' },
];

const MOCK_TASKS: Task[] = Array.from({ length: 30 }, (_, i) => {
  const id = i + 101;
  const statuses: TaskStatus[] = ['Todo', 'In Progress', 'Done'];
  const status = statuses[i % 3];

  // Varied dates
  const startDay = (i % 20) + 1;
  const endDay = startDay + (i % 5) + 2;
  const startDate = `Apr ${startDay.toString().padStart(2, '0')}`;
  const endDate = `Apr ${endDay.toString().padStart(2, '0')}`;

  const numAssignees = i % 5;
  const assignees = MOCK_USER_POOL.slice(0, numAssignees);

  const titles = [
    'Implement UI Component',
    'Fix Performance Issue',
    'Update Documentation',
    'Optimize Database Query',
    'Refactor API Auth',
    'Add Unit Tests',
    'Design New Feature',
    'Deploy to Production'
  ];

  // Generate comments - at least 1, up to 3 per task
  const numComments = (i % 3) + 1;
  const comments: TaskComment[] = Array.from({ length: numComments }, (_, j) => {
    const commentTemplate = commentTemplates[(i + j) % commentTemplates.length];
    const commentAuthor = MOCK_USER_POOL[(i + j) % MOCK_USER_POOL.length];
    return {
      id: `comment-${id}-${j}`,
      author: commentAuthor,
      body: commentTemplate.comment,
      createdAt: new Date(Date.now() - (numComments - j) * 86400000).toISOString(),
    };
  });

  return {
    id: `#${id}`,
    title: `Task ${id}: ${titles[i % titles.length]}`,
    startDate,
    endDate,
    status,
    assignees,
    progress: status === 'Done' ? 100 : (status === 'In Progress' ? 50 : 0),
    itemId: `item-${id}`,
    contentId: `content-${id}`,
    body: taskDescriptions[i % taskDescriptions.length],
    comments,
  };
});

const MOCK_TASKS_BUG_TRACKER: Task[] = Array.from({ length: 15 }, (_, i) => {
  const id = i + 201;
  const status: TaskStatus = i % 2 === 0 ? 'In Progress' : 'Todo';
  const assignees = [MOCK_USER_POOL[2], MOCK_USER_POOL[3], MOCK_USER_POOL[4]].slice(0, (i % 3) + 1);

  return {
    id: `#${id}`,
    title: `Bug ${id}: ${['Memory leak in sidebar', 'Incorrect alignment', 'API timeout', 'Console warning'][i % 4]}`,
    startDate: 'Apr 10',
    endDate: 'Apr 12',
    status,
    assignees,
    progress: status === 'In Progress' ? 30 : 0,
    itemId: `item-bug-${id}`,
    contentId: `content-bug-${id}`,
    body: 'Investigation in progress. This bug affects the stability of the latest release candidate.',
    comments: [],
  };
});

const CONNECTED_TASKS_TASKS: Task[] = [
  {
    id: '#101',
    title: 'Implement manual GitHub PAT support',
    startDate: 'Apr 05',
    endDate: 'Apr 06',
    status: 'In Progress',
    assignees: [{ id: 'u6', name: 'Jamie Varga', initials: 'JV', avatarColor: 'bg-cyan-100 text-cyan-700' }],
    progress: 50,
    itemId: 'item-pat-support',
    contentId: 'content-pat-support',
    body: 'Add support for users to authenticate using their own GitHub Personal Access Tokens. This will allow better privacy and control over permissions.',
    comments: [
      {
        id: 'comment-101-1',
        author: { id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
        body: 'Working on the token validation flow. Need to ensure we handle rate limiting properly.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'comment-101-2',
        author: { id: 'u2', name: 'Jordan Smith', initials: 'JS', avatarColor: 'bg-indigo-100 text-indigo-700' },
        body: 'Good idea. Also make sure we securely store the tokens in the database. Consider encryption.',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
  },
  {
    id: '#102',
    title: 'Fix modal stacking order (z-index)',
    startDate: 'Apr 05',
    endDate: 'Apr 05',
    status: 'Done',
    assignees: [{ id: 'u6', name: 'Jamie Varga', initials: 'JV', avatarColor: 'bg-cyan-100 text-cyan-700' }],
    progress: 100,
    itemId: 'item-z-index-fix',
    contentId: 'content-z-index-fix',
    body: 'Multiple modals were appearing behind each other. Updated z-index values to ensure proper stacking order: base modal 40, overlay 50, top modal 60.',
    comments: [
      {
        id: 'comment-102-1',
        author: { id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
        body: 'Fixed the issue. Tested with all modal combinations.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'comment-102-2',
        author: { id: 'u3', name: 'Casey Chen', initials: 'CC', avatarColor: 'bg-emerald-100 text-emerald-700' },
        body: 'Verified in production. No more modal overlap issues!',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: 'comment-102-3',
        author: { id: 'u5', name: 'Morgan Lee', initials: 'ML', avatarColor: 'bg-purple-100 text-purple-700' },
        body: 'Great catch! This was blocking several features.',
        createdAt: new Date(Date.now() - 21600000).toISOString(),
      },
    ],
  },
  {
    id: '#103',
    title: 'Add "Connected GitHub Tasks" mock project',
    startDate: 'Apr 05',
    endDate: 'Apr 05',
    status: 'Done',
    assignees: [{ id: 'u6', name: 'Jamie Varga', initials: 'JV', avatarColor: 'bg-cyan-100 text-cyan-700' }],
    progress: 100,
    itemId: 'item-mock-data',
    contentId: 'content-mock-data',
    body: 'Created a new mock project that simulates real GitHub task data. This helps with testing the connected GitHub tasks workflow.',
    comments: [
      {
        id: 'comment-103-1',
        author: { id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
        body: 'Added realistic task data with comments and history.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'comment-103-2',
        author: { id: 'u4', name: 'Taylor Reed', initials: 'TR', avatarColor: 'bg-rose-100 text-rose-700' },
        body: 'Perfect! This makes it much easier to test the sync workflow.',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
  }
];

// Helper to map tasks back to GitHub GraphQL nodes
function mapTaskToGraphQLNode(task: Task) {
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
  const endDateField = {
    __typename: 'ProjectV2ItemFieldDateValue',
    date: task.fullEndDate || new Date().toISOString(),
    field: { __typename: 'ProjectV2Field', id: MOCK_FIELD_IDS.endDate, name: 'End Date' },
  };

  return {
    id: task.itemId,
    content: {
      id: task.contentId,
      title: task.title,
      number: parseInt(task.id.replace('#', '')),
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
      },
      comments: {
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
      }
    },
    fieldValues: {
      nodes: [statusField, startDateField, endDateField]
    }
  };
}

export interface MockVariables {
  projectId?: string;
  itemId?: string;
  issueId?: string;
  subjectId?: string;
  body?: string;
  fieldId?: string;
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
    };
  };
  assignableId?: string;
  assigneeIds?: string[];
  query?: string;
  searchQuery?: string;
}

export async function handleMockGraphQL(query: string, variables: MockVariables) {
  console.log('[MockAPI] Handling GraphQL query:', { query: query.substring(0, 100) + '...', variables });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

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
          login: 'glidelines-demo',
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

  if (query.includes('items')) {
    // List project tasks
    return {
      data: {
        node: {
          public: variables.projectId === 'PVT_2' ? false : true,
          fields: {
            nodes: [
              {
                __typename: 'ProjectV2SingleSelectField',
                id: MOCK_FIELD_IDS.status,
                name: 'Status',
                options: MOCK_STATUS_OPTIONS
              }
            ]
          },
          items: {
            nodes: (variables.projectId === 'PVT_EMPTY' ? [] : (variables.projectId === 'PVT_3' ? CONNECTED_TASKS_TASKS : (variables.projectId === 'PVT_2' ? MOCK_TASKS_BUG_TRACKER : MOCK_TASKS))).map(mapTaskToGraphQLNode)
          }
        }
      }
    };
  }

  if (query.includes('node(id: $itemId)')) {
    // Fetch single item
    const itemId = variables.itemId;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Node not found' }] };

    return {
      data: {
        node: mapTaskToGraphQLNode(task)
      }
    };
  }

  if (query.includes('updateIssue(')) {
    const issueId = variables.input?.id || variables.issueId;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.contentId === issueId);
    if (!task) return { errors: [{ message: 'Issue not found' }] };

    if (variables.input?.title !== undefined) task.title = variables.input.title;
    if (variables.input?.body !== undefined) task.body = variables.input.body;
    if (variables.input?.assigneeIds !== undefined) {
      const selectedIds = variables.input.assigneeIds;
      task.assignees = MOCK_USER_POOL.filter(u => selectedIds.includes(u.id));
    }

    return { data: { updateIssue: { issue: { id: task.contentId } } } };
  }

  if (query.includes('addAssigneesToAssignable(')) {
    const issueId = variables.input?.assignableId || variables.assignableId;
    const assigneeIds = variables.input?.assigneeIds || variables.assigneeIds || [];
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.contentId === issueId);
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
    const issueId = variables.input?.assignableId || variables.assignableId;
    const assigneeIds = variables.input?.assigneeIds || variables.assigneeIds || [];
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.contentId === issueId);
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
    const commentId = variables.input?.id;
    const body = variables.input?.body;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
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
    const commentId = variables.input?.id;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
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
    const subjectId = variables.subjectId || variables.input?.subjectId;
    const body = variables.body || variables.input?.body;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.contentId === subjectId);
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
              id: newComment.id
            }
          }
        }
      }
    };
  }

  if (query.includes('updateProjectV2ItemFieldValue(')) {
    const itemId = variables.input?.itemId;
    const allTasks = [...MOCK_TASKS, ...MOCK_TASKS_BUG_TRACKER, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Item not found' }] };

    if (variables.input?.value?.singleSelectOptionId) {
      // Resolve status by option ID (real IDs from MOCK_STATUS_OPTIONS)
      const optionId = variables.input.value.singleSelectOptionId;
      const matched = MOCK_STATUS_OPTIONS.find(o => o.id === optionId);
      if (matched) {
        task.status = matched.name as TaskStatus;
        task.progress = task.status === 'Done' ? 100 : (task.status === 'In Progress' ? 50 : 0);
      }
    }
    if (variables.input?.value?.date) {
      const fieldId = variables.input?.fieldId ?? variables.fieldId;
      if (fieldId === MOCK_FIELD_IDS.startDate) {
        task.fullStartDate = variables.input.value.date;
        task.startDate = new Date(variables.input.value.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } else if (fieldId === MOCK_FIELD_IDS.endDate) {
        task.fullEndDate = variables.input.value.date;
        task.endDate = new Date(variables.input.value.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    }

    return { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: task.itemId } } } };
  }

  return { errors: [{ message: 'Mock query not implemented' }] };
}
