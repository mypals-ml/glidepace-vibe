import type { ProjectOwnerInfo, Task, TaskComment, TaskStatus, GitHubProjectV2Field } from '../types';

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
  targetDate: 'mock-end-date-id',
  estimate: 'mock-estimate-id',
  successor: 'mock-successors-id',
  predecessor: 'mock-predecessors-id',
};

export const MOCK_TOKEN = 'mock-token-123';

export const MOCK_ACCOUNTS_DATA = [
  { id: 'mock-1', login: 'octocat', name: 'Mona Lisa Octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4', token: MOCK_TOKEN },
];

export const MOCK_PROJECTS_DATA: ProjectOwnerInfo[] = [
  {
    login: 'octocat',
    isOrg: false,
    projects: [
      { id: 'PVT_1', title: 'Alpha Release Tracker', public: true },
      { id: 'PVT_2', title: 'Demo: Bug Tracker', public: false },
      { id: 'PVT_3', title: 'Connected GitHub Tasks', public: true },
      { id: 'PVT_4', title: 'Mobile App Redesign', public: false },
      { id: 'PVT_5', title: 'Zephyr Cloud Migration', public: true },
      { id: 'PVT_6', title: 'Customer Feedback Board', public: false },
      { id: 'PVT_7', title: 'Demo: Product Roadmap 2024', public: true },
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
  const targetDate = `Apr ${endDay.toString().padStart(2, '0')}`;

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
    id: `item-${id}`,
    displayId: `#${id}`,
    title: `Task ${id}: ${titles[i % titles.length]}`,
    startDate,
    targetDate,
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
    id: `item-bug-${id}`,
    displayId: `#${id}`,
    title: `Bug ${id}: ${['Memory leak in sidebar', 'Incorrect alignment', 'API timeout', 'Console warning'][i % 4]}`,
    startDate: 'Apr 10',
    targetDate: 'Apr 12',
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
    id: 'item-pat-support',
    displayId: '#101',
    title: 'Implement manual GitHub PAT support',
    startDate: 'Apr 05',
    targetDate: 'Apr 06',
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
    id: 'item-z-index-fix',
    displayId: '#102',
    title: 'Fix modal stacking order (z-index)',
    startDate: 'Apr 05',
    targetDate: 'Apr 05',
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
    id: 'item-mock-data',
    displayId: '#103',
    title: 'Add "Connected GitHub Tasks" mock project',
    startDate: 'Apr 05',
    targetDate: 'Apr 05',
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
function mapTaskToGraphQLNode(task: Task, projectId = 'PVT_1') {
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
      nodes: [statusField, startDateField, targetDateField, ...customFieldValues]
    }
  };
}

const MOCK_PROJECT_TASKS_MAP: Record<string, Task[]> = {
  'PVT_2': MOCK_TASKS_BUG_TRACKER,
  'PVT_3': CONNECTED_TASKS_TASKS,
  'PVT_EMPTY': [],
};

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
    return {
      data: {
        node: {
          public: projectId === 'PVT_2' ? false : true,
          fields: {
            nodes: getFieldsForProject(projectId)
          },
          items: {
            nodes: getTasksForProject(projectId).map(task => mapTaskToGraphQLNode(task, projectId))
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
              id: newComment.id
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
