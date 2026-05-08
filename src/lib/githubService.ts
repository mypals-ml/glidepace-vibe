import { GITHUB_GRAPHQL_API_URL } from './constants';
import { handleMockGraphQL, MOCK_TOKEN, type MockVariables } from './githubMock';
import { 
  GET_REPOSITORY_ID_QUERY, 
  CREATE_ISSUE_MUTATION, 
  ADD_PROJECT_ITEM_MUTATION,
  ADD_DRAFT_ISSUE_MUTATION,
  UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION,
  CREATE_PROJECT_V2_FIELD_MUTATION
} from './githubQueries';

export async function fetchGitHubGraphQL(query: string, variables: Record<string, unknown> = {}, token: string) {
  // Check if we should use mock data
  // Force mock if token is mock-token OR if the project ID is the dummy project ID
  if (token === MOCK_TOKEN ||
    (typeof variables.projectId === 'string' && (variables.projectId === 'PVT_2' || variables.projectId === 'PVT_3')) ||
    (typeof variables.itemId === 'string' && variables.itemId.startsWith('item-'))) {
    return handleMockGraphQL(query, variables as MockVariables);
  }

  // Real API call
  try {
    console.log('[GitHubAPI] Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetch(GITHUB_GRAPHQL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[GitHubAPI] ❌ Error: ${res.status}`, errorText);
      throw new Error(`GitHub API error: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    if (data.errors) {
      console.warn(`[GitHubAPI] ⚠️ GraphQL Errors for query ${query.slice(0, 50)}...`, data.errors);
    }
    return data;
  } catch (error: unknown) {
    console.error('Fetch GitHub GraphQL failed:', error);
    throw error;
  }
}

/**
 * Check if a token is a mock token.
 */
export function isMockToken(token: string): boolean {
  return token === MOCK_TOKEN;
}

// ---- High-level helpers ----

export async function getRepositoryId(owner: string, name: string, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(GET_REPOSITORY_ID_QUERY, { owner, name }, token);
  return json.data?.repository?.id || null;
}

export async function createGitHubIssue(repositoryId: string, title: string, body: string | undefined, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(CREATE_ISSUE_MUTATION, { repositoryId, title, body }, token);
  return json.data?.createIssue?.issue?.id || null;
}

export async function addProjectV2Item(projectId: string, contentId: string, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(ADD_PROJECT_ITEM_MUTATION, { projectId, contentId }, token);
  return json.data?.addProjectV2ItemById?.item?.id || null;
}

export async function addProjectV2DraftIssue(projectId: string, title: string, body: string | undefined, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(ADD_DRAFT_ISSUE_MUTATION, { projectId, title, body }, token);
  return json.data?.addProjectV2DraftIssue?.projectItem?.id || null;
}

export async function updateProjectV2ItemField(projectId: string, itemId: string, fieldId: string, value: unknown, token: string): Promise<boolean> {
  try {
    console.log('[GitHubAPI] Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetchGitHubGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, { projectId, itemId, fieldId, value }, token);
    if (res.errors) {
      console.error('Update field failed:', res.errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Update field failed:', e);
    return false;
  }
}

export async function createProjectV2Field(projectId: string, name: string, dataType: string, token: string, singleSelectOptions?: { name: string; description: string; color: string }[]): Promise<string | null> {
  try {
    const variables: Record<string, unknown> = { projectId, name, dataType };
    if (singleSelectOptions) {
      variables.singleSelectOptions = singleSelectOptions;
    }
    const json = await fetchGitHubGraphQL(CREATE_PROJECT_V2_FIELD_MUTATION, variables, token);
    if (json.errors) {
      console.error('Create field failed:', json.errors);
      return null;
    }
    return json.data?.createProjectV2Field?.projectV2Field?.id || null;
  } catch (e) {
    console.error('Create field failed:', e);
    return null;
  }
}
