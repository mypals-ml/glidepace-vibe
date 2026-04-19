import { fetchGitHubGraphQL } from '../lib/githubService';
import { PROJECT_ITEM_FRAGMENT } from '../lib/githubTaskMapper';

// ========================================
// Queries
// ========================================

export const FETCH_SINGLE_PROJECT_ITEM_QUERY = `
  query($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        ${PROJECT_ITEM_FRAGMENT}
      }
    }
  }
`;

export const FETCH_PROJECT_TASKS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        public
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name color }
            }
          }
        }
        items(first: 50) {
          nodes {
            ${PROJECT_ITEM_FRAGMENT}
          }
        }
      }
    }
  }
`;

export const FETCH_USER_PROJECTS_QUERY = `
  query {
    viewer {
      login
      databaseId
      projectsV2(first: 20) {
        nodes { id title public }
      }
      organizations(first: 10) {
        nodes {
          login
          databaseId
          projectsV2(first: 20) {
            nodes { id title public }
          }
        }
      }
    }
  }
`;

export const FETCH_ASSIGNABLE_USERS_QUERY = `
  query($owner: String!, $name: String!, $query: String) {
    repository(owner: $owner, name: $name) {
      assignableUsers(first: 20, query: $query) {
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const FETCH_ORG_MEMBERS_QUERY = `
  query($login: String!) {
    organization(login: $login) {
      membersWithRole(first: 20) {
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const SEARCH_USERS_QUERY = `
  query($searchQuery: String!) {
    search(query: $searchQuery, type: USER, first: 10) {
      nodes {
        ... on User {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const GET_REPOSITORY_ID_QUERY = `
  query GetRepository($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

// ========================================
// Mutations
// ========================================

export const ADD_ASSIGNEES_MUTATION = `
  mutation($issueId: ID!, $assigneeIds: [ID!]!) {
    addAssigneesToAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
      assignable {
        ... on Issue {
          id
          assignees(first: 10) {
            nodes { id login name avatarUrl }
          }
        }
      }
    }
  }
`;

export const REMOVE_ASSIGNEES_MUTATION = `
  mutation($issueId: ID!, $assigneeIds: [ID!]!) {
    removeAssigneesFromAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
      assignable {
        ... on Issue {
          id
          assignees(first: 10) {
            nodes { id login name avatarUrl }
          }
        }
      }
    }
  }
`;

export const UPDATE_PROJECT_ITEM_FIELD_MUTATION = `
  mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
      projectV2Item { id }
    }
  }
`;

export const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: {
      repositoryId: $repositoryId
      title: $title
      body: $body
    }) {
      issue {
        id
      }
    }
  }
`;

export const ADD_PROJECT_ITEM_MUTATION = `
  mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`;

export const ADD_DRAFT_ITEM_MUTATION = `
  mutation AddDraftItem($projectId: ID!, $title: String!, $body: String) {
    addProjectV2DraftIssue(input: {
      projectId: $projectId
      title: $title
      body: $body
    }) {
      projectItem {
        id
      }
    }
  }
`;

export const UPDATE_ISSUE_TITLE_MUTATION = `
  mutation UpdateIssue($id: ID!, $title: String!) {
    updateIssue(input: { id: $id, title: $title }) {
      issue { id }
    }
  }
`;

export const UPDATE_ISSUE_BODY_MUTATION = `
  mutation UpdateIssue($id: ID!, $body: String!) {
    updateIssue(input: { id: $id, body: $body }) {
      issue { id }
    }
  }
`;

export const UPDATE_COMMENT_MUTATION = `
  mutation UpdateIssueComment($id: ID!, $body: String!) {
    updateIssueComment(input: { id: $id, body: $body }) {
      issueComment { id }
    }
  }
`;

export const DELETE_COMMENT_MUTATION = `
  mutation DeleteIssueComment($id: ID!) {
    deleteIssueComment(input: { id: $id }) {
      clientMutationId
    }
  }
`;

export const ADD_COMMENT_MUTATION = `
  mutation AddComment($subjectId: ID!, $body: String!) {
    addComment(input: { subjectId: $subjectId, body: $body }) {
      commentEdge {
        node { id }
      }
    }
  }
`;

// ========================================
// Service Functions
// ========================================

export async function fetchSingleProjectItemApi(itemId: string, token: string) {
  return fetchGitHubGraphQL(FETCH_SINGLE_PROJECT_ITEM_QUERY, { itemId }, token);
}

export async function fetchProjectTasksApi(projectId: string, token: string) {
  return fetchGitHubGraphQL(FETCH_PROJECT_TASKS_QUERY, { projectId }, token);
}

export async function fetchUserProjectsApi(token: string) {
  return fetchGitHubGraphQL(FETCH_USER_PROJECTS_QUERY, {}, token);
}

export async function fetchAssignableUsersApi(owner: string, name: string, searchTerm: string | undefined, token: string) {
  return fetchGitHubGraphQL(FETCH_ASSIGNABLE_USERS_QUERY, { owner, name, query: searchTerm }, token);
}

export async function fetchOrgMembersApi(login: string, token: string) {
  return fetchGitHubGraphQL(FETCH_ORG_MEMBERS_QUERY, { login }, token);
}

export async function searchUsersApi(searchQuery: string, token: string) {
  return fetchGitHubGraphQL(SEARCH_USERS_QUERY, { searchQuery }, token);
}

export async function updateProjectItemFieldApi(projectId: string, itemId: string, fieldId: string, value: unknown, token: string) {
  return fetchGitHubGraphQL(UPDATE_PROJECT_ITEM_FIELD_MUTATION, { projectId, itemId, fieldId, value }, token);
}

export async function addAssigneesApi(issueId: string, assigneeIds: string[], token: string) {
  return fetchGitHubGraphQL(ADD_ASSIGNEES_MUTATION, { issueId, assigneeIds }, token);
}

export async function removeAssigneesApi(issueId: string, assigneeIds: string[], token: string) {
  return fetchGitHubGraphQL(REMOVE_ASSIGNEES_MUTATION, { issueId, assigneeIds }, token);
}

export async function getRepositoryIdApi(owner: string, name: string, token: string) {
  return fetchGitHubGraphQL(GET_REPOSITORY_ID_QUERY, { owner, name }, token);
}

export async function createIssueApi(repositoryId: string, title: string, body: string | undefined, token: string) {
  return fetchGitHubGraphQL(CREATE_ISSUE_MUTATION, { repositoryId, title, body }, token);
}

export async function addProjectItemApi(projectId: string, contentId: string, token: string) {
  return fetchGitHubGraphQL(ADD_PROJECT_ITEM_MUTATION, { projectId, contentId }, token);
}

export async function addDraftItemApi(projectId: string, title: string, body: string | undefined, token: string) {
  return fetchGitHubGraphQL(ADD_DRAFT_ITEM_MUTATION, { projectId, title, body }, token);
}

export async function updateIssueTitleApi(id: string, title: string, token: string) {
  return fetchGitHubGraphQL(UPDATE_ISSUE_TITLE_MUTATION, { id, title }, token);
}

export async function updateIssueBodyApi(id: string, body: string, token: string) {
  return fetchGitHubGraphQL(UPDATE_ISSUE_BODY_MUTATION, { id, body }, token);
}

export async function updateCommentApi(id: string, body: string, token: string) {
  return fetchGitHubGraphQL(UPDATE_COMMENT_MUTATION, { id, body }, token);
}

export async function deleteCommentApi(id: string, token: string) {
  return fetchGitHubGraphQL(DELETE_COMMENT_MUTATION, { id }, token);
}

export async function addCommentApi(subjectId: string, body: string, token: string) {
  return fetchGitHubGraphQL(ADD_COMMENT_MUTATION, { subjectId, body }, token);
}
