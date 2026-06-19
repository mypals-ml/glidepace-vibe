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
export const MOCK_FIELD_IDS = {
  status: 'mock-status-field-id',
  startDate: 'mock-start-date-id',
  targetDate: 'mock-end-date-id',
  estimate: 'mock-estimate-id',
  successor: 'mock-successors-id',
  predecessor: 'mock-predecessors-id',
  groupPath: 'mock-group-path-id',
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
      { id: 'PVT_100_COMMENTS', title: '100 Comments Demo Project', public: true },
      { id: 'PVT_EMPTY', title: 'Empty Project Demo', public: true },
    ],
  },
];

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

export const MOCK_TASKS: Task[] = Array.from({ length: 30 }, (_, i) => {
  const id = i + 101;
  const statuses: TaskStatus[] = ['Todo', 'In Progress', 'Done'];
  const status = statuses[i % 3];

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
  const groupPath = i === 0
    ? []
    : i < 7
      ? ['Planning']
      : i < 13
        ? ['Planning', 'Research']
        : i < 18
          ? []
          : i < 24
            ? ['Delivery']
            : ['Planning'];

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
    groupPath,
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
    groupPath: i < 5 ? ['Triage'] : i < 10 ? ['Fixes'] : ['Verification'],
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
    groupPath: ['Authentication'],
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
    groupPath: ['Interface'],
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
    groupPath: ['Interface'],
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

const MOCK_100_COMMENTS: TaskComment[] = Array.from({ length: 100 }, (_, index) => {
  const authorIndex = index % MOCK_USER_POOL.length;
  const author = MOCK_USER_POOL[authorIndex];
  return {
    id: `comment-100-comments-${index + 1}`,
    author: {
      id: author.id,
      login: author.login,
      name: author.name,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=random`,
      avatarColor: author.avatarColor,
      initials: author.initials,
    },
    body: `This is comment #${index + 1} for testing dynamic pagination of comments page-by-page.`,
    createdAt: new Date(Date.now() - (100 - index) * 60000).toISOString(),
  };
});

const TASKS_100_COMMENTS: Task[] = [
  {
    id: 'item-100-comments-1',
    displayId: '#1001',
    itemId: 'item-100-comments-1',
    contentId: 'content-100-comments-1',
    title: 'Task with 100 comments for pagination testing',
    body: 'This task is pre-populated with exactly 100 comments to test dynamic comments loading pagination of 30 items at a time.',
    status: 'In Progress',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    assignees: [MOCK_USER_POOL[0]],
    progress: 30,
    comments: MOCK_100_COMMENTS,
    groupPath: [],
  }
];

export const MOCK_PROJECT_TASKS_MAP: Record<string, Task[]> = {
  'PVT_2': MOCK_TASKS_BUG_TRACKER,
  'PVT_3': CONNECTED_TASKS_TASKS,
  'PVT_100_COMMENTS': TASKS_100_COMMENTS,
  'PVT_EMPTY': [],
};
