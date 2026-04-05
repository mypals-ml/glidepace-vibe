import type { ProjectOwnerInfo, Task } from '../types';

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
    ],
  },
];

const MOCK_TASKS: Task[] = [
  {
    id: '#101',
    title: 'Design System Implementation',
    startDate: 'Apr 01',
    endDate: 'Apr 05',
    status: 'Done',
    assignees: [{ id: 'u1', name: 'Alex Rivera', initials: 'AR', avatarColor: 'bg-amber-200 text-amber-700' }],
    progress: 100,
    itemId: 'item-1',
    contentId: 'content-1',
  },
  {
    id: '#102',
    title: 'Gantt Chart View Component',
    startDate: 'Apr 06',
    endDate: 'Apr 12',
    status: 'In Progress',
    assignees: [
      { id: 'u2', name: 'Jordan Smith', initials: 'JS', avatarColor: 'bg-indigo-200 text-indigo-700' },
      { id: 'u3', name: 'Casey Chen', initials: 'CC', avatarColor: 'bg-emerald-200 text-emerald-700' }
    ],
    progress: 45,
    itemId: 'item-2',
    contentId: 'content-2',
  },
  {
    id: '#103',
    title: 'GitHub API Integration Layer',
    startDate: 'Apr 10',
    endDate: 'Apr 15',
    status: 'Todo',
    assignees: [{ id: 'u4', name: 'Taylor Reed', initials: 'TR', avatarColor: 'bg-rose-200 text-rose-700' }],
    progress: 0,
    itemId: 'item-3',
    contentId: 'content-3',
  },
  {
    id: '#104',
    title: 'Mobile Layout Optimization',
    startDate: 'Apr 16',
    endDate: 'Apr 20',
    status: 'Todo',
    assignees: [{ id: 'u5', name: 'Morgan Lee', initials: 'ML', avatarColor: 'bg-purple-200 text-purple-700' }],
    progress: 0,
    itemId: 'item-4',
    contentId: 'content-4',
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
      repository: { nameWithOwner: 'glidepace/glidelines' },
      assignees: {
        nodes: task.assignees.map(a => ({
          login: a.id,
          name: a.name,
          avatarUrl: a.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=random`
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
            nodes: MOCK_TASKS.map(mapTaskToGraphQLNode)
          }
        }
      }
    };
  }

  if (query.includes('node(id: $itemId)')) {
    // Fetch single item
    const itemId = variables.itemId;
    const task = MOCK_TASKS.find(t => t.itemId === itemId);
    if (!task) return { errors: [{ message: 'Node not found' }] };
    
    return {
      data: {
        node: mapTaskToGraphQLNode(task)
      }
    };
  }

  return { errors: [{ message: 'Mock query not implemented' }] };
}
