import type { ProjectOwnerInfo, Task, TaskComment, TaskStatus } from '../types';

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
      { id: DUMMY_PROJECT_ID, title: 'Demo: Product Roadmap 2024' },
      { id: 'PVT_2', title: 'Demo: Bug Tracker' },
      { id: 'PVT_3', title: 'Connected GitHub Tasks' },
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

const MOCK_TASKS: Task[] = Array.from({ length: 30 }, (_, i) => {
  const id = i + 101;
  const statuses: TaskStatus[] = ['Todo', 'In Progress', 'Done'];
  const status = statuses[i % 3];

  // Varied dates
  const startDay = (i % 20) + 1;
  const endDay = startDay + (i % 5) + 2;
  const startDate = `Apr ${startDay.toString().padStart(2, '0')}`;
  const endDate = `Apr ${endDay.toString().padStart(2, '0')}`;

  const assigneePool = [
    { id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' },
    { id: 'u2', name: 'Jordan Smith', initials: 'JS', avatarColor: 'bg-indigo-100 text-indigo-700' },
    { id: 'u3', name: 'Casey Chen', initials: 'CC', avatarColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'u4', name: 'Taylor Reed', initials: 'TR', avatarColor: 'bg-rose-100 text-rose-700' },
    { id: 'u5', name: 'Morgan Lee', initials: 'ML', avatarColor: 'bg-purple-100 text-purple-700' },
  ];

  const numAssignees = (i % 2) + 1;
  const assignees = assigneePool.slice(i % 4, (i % 4) + numAssignees);

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
    const commentAuthor = assigneePool[(i + j) % assigneePool.length];
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

const CONNECTED_TASKS_TASKS: Task[] = [
  {
    id: '#101',
    title: 'Implement manual GitHub PAT support',
    startDate: 'Apr 05',
    endDate: 'Apr 06',
    status: 'In Progress',
    assignees: [{ id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' }],
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
    assignees: [{ id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' }],
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
    assignees: [{ id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-100 text-amber-700' }],
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
  const statusField = {
    name: task.status,
    field: { name: 'Status' }
  };
  const startDateField = {
    date: task.fullStartDate || new Date().toISOString(),
    field: { name: 'Start Date' }
  };
  const endDateField = {
    date: task.fullEndDate || new Date().toISOString(),
    field: { name: 'End Date' }
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
          login: a.id,
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

export async function handleMockGraphQL(query: string, variables: any) {
  console.log('[MockAPI] Handling GraphQL query:', { query: query.substring(0, 100) + '...', variables });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

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

  if (query.includes('items')) {
    // List project tasks
    return {
      data: {
        node: {
          items: {
            nodes: (variables.projectId === 'PVT_3' ? CONNECTED_TASKS_TASKS : MOCK_TASKS).map(mapTaskToGraphQLNode)
          }
        }
      }
    };
  }

  if (query.includes('node(id: $itemId)')) {
    // Fetch single item
    const itemId = variables.itemId;
    const allTasks = [...MOCK_TASKS, ...CONNECTED_TASKS_TASKS];
    const task = allTasks.find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Node not found' }] };

    return {
      data: {
        node: mapTaskToGraphQLNode(task)
      }
    };
  }

  return { errors: [{ message: 'Mock query not implemented' }] };
}
