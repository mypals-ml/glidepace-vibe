import { fetchGitHubGraphQL } from './githubService';
import { PROJECT_ITEM_FRAGMENT } from './githubTaskMapper';

// ========================================
// GitHub GraphQL Operations
// ========================================

// --- Queries ---

export async function fetchSingleProjectItemGQL(itemId: string, token: string) {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          ${PROJECT_ITEM_FRAGMENT}
        }
      }
    }
  `;
  return fetchGitHubGraphQL(query, { itemId }, token);
}

export async function fetchProjectTasksGQL(projectId: string, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { projectId }, token);
}

export async function fetchUserProjectsGQL(token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, {}, token);
}

// --- Mutations ---

export async function updateItemFieldGQL(
  projectId: string,
  itemId: string,
  fieldId: string,
  value: Record<string, unknown>,
  token: string,
) {
  const query = `mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) { projectV2Item { id } } }`;
  return fetchGitHubGraphQL(query, { projectId, itemId, fieldId, value }, token);
}

export async function updateIssueTitleGQL(contentId: string, title: string, token: string) {
  const query = `mutation UpdateIssue($id: ID!, $title: String!) { updateIssue(input: { id: $id, title: $title }) { issue { id } } }`;
  return fetchGitHubGraphQL(query, { id: contentId, title }, token);
}

export async function updateIssueBodyGQL(contentId: string, body: string, token: string) {
  const query = `mutation UpdateIssue($id: ID!, $body: String!) { updateIssue(input: { id: $id, body: $body }) { issue { id } } }`;
  return fetchGitHubGraphQL(query, { id: contentId, body }, token);
}

export async function addCommentGQL(subjectId: string, body: string, token: string) {
  const query = `mutation AddComment($subjectId: ID!, $body: String!) { addComment(input: { subjectId: $subjectId, body: $body }) { commentEdge { node { id } } } }`;
  return fetchGitHubGraphQL(query, { subjectId, body }, token);
}

export async function updateCommentGQL(commentId: string, body: string, token: string) {
  const query = `mutation UpdateIssueComment($id: ID!, $body: String!) { updateIssueComment(input: { id: $id, body: $body }) { issueComment { id } } }`;
  return fetchGitHubGraphQL(query, { id: commentId, body }, token);
}

export async function deleteCommentGQL(commentId: string, token: string) {
  const query = `mutation DeleteIssueComment($id: ID!) { deleteIssueComment(input: { id: $id }) { clientMutationId } }`;
  return fetchGitHubGraphQL(query, { id: commentId }, token);
}

export async function addAssigneesGQL(issueId: string, assigneeIds: string[], token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { issueId, assigneeIds }, token);
}

export async function removeAssigneesGQL(issueId: string, assigneeIds: string[], token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { issueId, assigneeIds }, token);
}

export async function searchAssignableUsersGQL(
  owner: string,
  name: string,
  searchTerm: string | undefined,
  token: string,
) {
  const query = `
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
  return fetchGitHubGraphQL(query, { owner, name, query: searchTerm }, token);
}

export async function searchOrgMembersGQL(login: string, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { login }, token);
}

export async function searchUsersGlobalGQL(searchQuery: string, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { searchQuery }, token);
}

export async function getRepositoryIdGQL(owner: string, name: string, token: string) {
  const query = `
    query GetRepository($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
      }
    }
  `;
  return fetchGitHubGraphQL(query, { owner, name }, token);
}

export async function createIssueGQL(repositoryId: string, title: string, body: string | undefined, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { repositoryId, title, body }, token);
}

export async function addProjectItemGQL(projectId: string, contentId: string, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { projectId, contentId }, token);
}

export async function createDraftItemGQL(projectId: string, title: string, body: string | undefined, token: string) {
  const query = `
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
  return fetchGitHubGraphQL(query, { projectId, title, body }, token);
}
