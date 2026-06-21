import type { Task, TaskComment } from '../types';
import { logDashboardEvent } from './dashboardDebugLog';
import {
  MOCK_FIELD_IDS,
  MOCK_PROJECTS_DATA,
  MOCK_PROJECT_TASKS_MAP,
  MOCK_USER_POOL,
} from './githubMockData';
import {
  MOCK_PROJECT_FIELDS_MAP,
  MOCK_PROJECT_READMES_MAP,
  applyMockFieldValue,
  mapTaskToGraphQLNode,
  getFieldsForProject,
  getTasksForProject,
  getAllMockTasks,
  type MockFieldValueInput,
  type MockVariables,
} from './githubMock';

export type { MockVariables, MockFieldValueInput } from './githubMock';

export async function handleMockOperation(query: string, variables: MockVariables) {
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

  if (query.includes('updateProjectV2(')) {
    const projectId = getVar('projectId');
    const readme = getVar('readme');
    if (typeof projectId === 'string' && typeof readme === 'string') {
      MOCK_PROJECT_READMES_MAP[projectId] = readme;
    }

    return {
      data: {
        updateProjectV2: {
          projectV2: {
            id: projectId,
            readme,
          },
        },
      },
    };
  }

  if (query.includes('readme') && query.includes('node(id: $projectId)')) {
    const projectId = variables.projectId || 'PVT_1';
    return {
      data: {
        node: {
          readme: MOCK_PROJECT_READMES_MAP[projectId] ?? '',
        },
      },
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
    const projectId = variables.projectId || Object.keys(MOCK_PROJECT_TASKS_MAP || {}).find(id => getTasksForProject(id).some(t => t.itemId === itemId));

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
