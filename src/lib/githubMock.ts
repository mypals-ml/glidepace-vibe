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

  return {
    id: `#${id}`,
    title: `Task ${id}: ${[
      'Implement UI Component',
      'Fix Performance Issue',
      'Update Documentation',
      'Optimize Database Query',
      'Refactor API Auth',
      'Add Unit Tests',
      'Design New Feature',
      'Deploy to Production'
    ][i % 8]}`,
    startDate,
    endDate,
    status,
    assignees,
    progress: status === 'Done' ? 100 : (status === 'In Progress' ? 50 : 0),
    itemId: `item-${id}`,
    contentId: `content-${id}`,
  };
});

import type { TaskStatus } from '../types';

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
