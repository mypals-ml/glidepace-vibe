import { fetchGitHubGraphQL } from './githubService';
import { PROJECT_ITEM_FRAGMENT } from './githubTaskMapper';
import type {
  GitHubAssignee,
  GitHubProjectItem,
  GitHubProjectV2,
} from '../types';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function runMutation<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res: GraphQLResponse<T> = await fetchGitHubGraphQL(query, variables, token);
  if (res.errors) throw new Error(res.errors[0]?.message || 'GraphQL error');
  return res.data as T;
}

// ============ Viewer / projects ============

export interface ViewerProjectsData {
  viewer?: {
    login: string;
    databaseId?: number;
    projectsV2?: { nodes: Array<{ id: string; title: string; public: boolean } | null> };
    organizations?: {
      nodes: Array<{
        login: string;
        databaseId?: number;
        projectsV2?: { nodes: Array<{ id: string; title: string; public: boolean } | null> };
      } | null>;
    };
  };
}

export function fetchViewerProjects(token: string): Promise<GraphQLResponse<ViewerProjectsData>> {
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

// ============ Project items ============

export function fetchProjectWithItems(
  projectId: string,
  token: string,
): Promise<GraphQLResponse<{ node: GitHubProjectV2 }>> {
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

export async function fetchProjectItem(
  itemId: string,
  token: string,
): Promise<GitHubProjectItem | null> {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          ${PROJECT_ITEM_FRAGMENT}
        }
      }
    }
  `;
  const json: GraphQLResponse<{ node: GitHubProjectItem }> = await fetchGitHubGraphQL(query, { itemId }, token);
  return json.data?.node ?? null;
}

// ============ Project field mutations ============

const UPDATE_FIELD_VALUE_MUTATION = `
  mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
      projectV2Item { id }
    }
  }
`;

export function setProjectItemStatus(params: {
  projectId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
  token: string;
}): Promise<unknown> {
  const { projectId, itemId, fieldId, optionId, token } = params;
  return runMutation(
    UPDATE_FIELD_VALUE_MUTATION,
    { projectId, itemId, fieldId, value: { singleSelectOptionId: optionId } },
    token,
  );
}

export function setProjectItemDate(params: {
  projectId: string;
  itemId: string;
  fieldId: string;
  date: string;
  token: string;
}): Promise<unknown> {
  const { projectId, itemId, fieldId, date, token } = params;
  return runMutation(
    UPDATE_FIELD_VALUE_MUTATION,
    { projectId, itemId, fieldId, value: { date: new Date(date).toISOString() } },
    token,
  );
}

// ============ Issue / comment mutations ============

export function updateIssueTitle(issueId: string, title: string, token: string): Promise<unknown> {
  const query = `mutation UpdateIssue($id: ID!, $title: String!) { updateIssue(input: { id: $id, title: $title }) { issue { id } } }`;
  return runMutation(query, { id: issueId, title }, token);
}

export function updateIssueBody(issueId: string, body: string, token: string): Promise<unknown> {
  const query = `mutation UpdateIssue($id: ID!, $body: String!) { updateIssue(input: { id: $id, body: $body }) { issue { id } } }`;
  return runMutation(query, { id: issueId, body }, token);
}

export function updateIssueCommentBody(commentId: string, body: string, token: string): Promise<unknown> {
  const query = `mutation UpdateIssueComment($id: ID!, $body: String!) { updateIssueComment(input: { id: $id, body: $body }) { issueComment { id } } }`;
  return runMutation(query, { id: commentId, body }, token);
}

export function deleteIssueComment(commentId: string, token: string): Promise<unknown> {
  const query = `mutation DeleteIssueComment($id: ID!) { deleteIssueComment(input: { id: $id }) { clientMutationId } }`;
  return runMutation(query, { id: commentId }, token);
}

export function addIssueComment(subjectId: string, body: string, token: string): Promise<unknown> {
  const query = `mutation AddComment($subjectId: ID!, $body: String!) { addComment(input: { subjectId: $subjectId, body: $body }) { commentEdge { node { id } } } }`;
  return runMutation(query, { subjectId, body }, token);
}

// ============ Assignees ============

interface AssignMutationResult {
  addAssigneesToAssignable?: { assignable?: { assignees?: { nodes?: GitHubAssignee[] } } };
  removeAssigneesFromAssignable?: { assignable?: { assignees?: { nodes?: GitHubAssignee[] } } };
}

export async function addAssignees(
  issueId: string,
  assigneeIds: string[],
  token: string,
): Promise<GitHubAssignee[] | undefined> {
  const query = `
    mutation($issueId: ID!, $assigneeIds: [ID!]!) {
      addAssigneesToAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
        assignable {
          ... on Issue {
            id
            assignees(first: 10) { nodes { id login name avatarUrl } }
          }
        }
      }
    }
  `;
  const data = await runMutation<AssignMutationResult>(query, { issueId, assigneeIds }, token);
  return data.addAssigneesToAssignable?.assignable?.assignees?.nodes;
}

export async function removeAssignees(
  issueId: string,
  assigneeIds: string[],
  token: string,
): Promise<GitHubAssignee[] | undefined> {
  const query = `
    mutation($issueId: ID!, $assigneeIds: [ID!]!) {
      removeAssigneesFromAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
        assignable {
          ... on Issue {
            id
            assignees(first: 10) { nodes { id login name avatarUrl } }
          }
        }
      }
    }
  `;
  const data = await runMutation<AssignMutationResult>(query, { issueId, assigneeIds }, token);
  return data.removeAssigneesFromAssignable?.assignable?.assignees?.nodes;
}

// ============ Task creation ============

export async function fetchRepositoryId(
  owner: string,
  name: string,
  token: string,
): Promise<string | undefined> {
  const query = `
    query GetRepository($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id }
    }
  `;
  const json: GraphQLResponse<{ repository?: { id?: string } }> = await fetchGitHubGraphQL(
    query,
    { owner, name },
    token,
  );
  return json.data?.repository?.id;
}

export async function createIssue(
  repositoryId: string,
  title: string,
  body: string | undefined,
  token: string,
): Promise<string | undefined> {
  const query = `
    mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
      createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
        issue { id }
      }
    }
  `;
  const json: GraphQLResponse<{ createIssue?: { issue?: { id?: string } } }> = await fetchGitHubGraphQL(
    query,
    { repositoryId, title, body },
    token,
  );
  return json.data?.createIssue?.issue?.id;
}

export async function addProjectItemByContentId(
  projectId: string,
  contentId: string,
  token: string,
): Promise<string | undefined> {
  const query = `
    mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;
  const json: GraphQLResponse<{ addProjectV2ItemById?: { item?: { id?: string } } }> = await fetchGitHubGraphQL(
    query,
    { projectId, contentId },
    token,
  );
  return json.data?.addProjectV2ItemById?.item?.id;
}

export async function createDraftProjectItem(
  projectId: string,
  title: string,
  body: string | undefined,
  token: string,
): Promise<string | undefined> {
  const query = `
    mutation AddDraftItem($projectId: ID!, $title: String!, $body: String) {
      addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
        projectItem { id }
      }
    }
  `;
  const json: GraphQLResponse<{ addProjectV2DraftIssue?: { projectItem?: { id?: string } } }> = await fetchGitHubGraphQL(
    query,
    { projectId, title, body },
    token,
  );
  return json.data?.addProjectV2DraftIssue?.projectItem?.id;
}

// ============ User search ============

export interface GitHubUserNode {
  id?: string;
  login?: string;
  name?: string;
  avatarUrl?: string;
}

export async function searchAssignableUsers(
  owner: string,
  name: string,
  searchTerm: string | undefined,
  token: string,
): Promise<GitHubUserNode[]> {
  const query = `
    query($owner: String!, $name: String!, $query: String) {
      repository(owner: $owner, name: $name) {
        assignableUsers(first: 20, query: $query) {
          nodes { id login name avatarUrl }
        }
      }
    }
  `;
  const json: GraphQLResponse<{ repository?: { assignableUsers?: { nodes?: GitHubUserNode[] } } }> =
    await fetchGitHubGraphQL(query, { owner, name, query: searchTerm || undefined }, token);
  return json.data?.repository?.assignableUsers?.nodes || [];
}

export async function fetchOrgMembers(orgLogin: string, token: string): Promise<GitHubUserNode[]> {
  const query = `
    query($login: String!) {
      organization(login: $login) {
        membersWithRole(first: 20) {
          nodes { id login name avatarUrl }
        }
      }
    }
  `;
  const json: GraphQLResponse<{ organization?: { membersWithRole?: { nodes?: GitHubUserNode[] } } }> =
    await fetchGitHubGraphQL(query, { login: orgLogin }, token);
  return json.data?.organization?.membersWithRole?.nodes || [];
}

export async function searchGlobalUsers(searchQuery: string, token: string): Promise<GitHubUserNode[]> {
  const query = `
    query($searchQuery: String!) {
      search(query: $searchQuery, type: USER, first: 10) {
        nodes { ... on User { id login name avatarUrl } }
      }
    }
  `;
  const json: GraphQLResponse<{ search?: { nodes?: GitHubUserNode[] } }> = await fetchGitHubGraphQL(
    query,
    { searchQuery },
    token,
  );
  return json.data?.search?.nodes || [];
}

// ============ REST: validate a PAT ============

export interface GitHubRestUser {
  id: number;
  login: string;
  name?: string;
  avatar_url: string;
}

export async function validateUserToken(
  token: string,
): Promise<{ ok: true; user: GitHubRestUser } | { ok: false; error: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Invalid token' }));
    return { ok: false, error: errorData.message || 'Invalid token' };
  }
  const user = (await res.json()) as GitHubRestUser;
  return { ok: true, user };
}
