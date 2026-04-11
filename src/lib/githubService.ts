import { GITHUB_GRAPHQL_API_URL } from './constants';
import { handleMockGraphQL, MOCK_TOKEN, type MockVariables } from './githubMock';

export async function fetchGitHubGraphQL(query: string, variables: Record<string, unknown> = {}, token: string) {
  // Check if we should use mock data
  // Force mock if token is mock-token OR if the project ID is the dummy project ID
  if (token === MOCK_TOKEN ||
    (typeof variables.projectId === 'string' && (variables.projectId === 'PVT_DUMMY_123' || variables.projectId === 'PVT_2' || variables.projectId === 'PVT_3')) ||
    (typeof variables.itemId === 'string' && variables.itemId.startsWith('item-'))) {
    return handleMockGraphQL(query, variables as MockVariables);
  }

  // Real API call
  try {
    const res = await fetch(GITHUB_GRAPHQL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Github-Next-Global-ID': '1',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`GitHub API error: ${res.status} ${errorText}`);
    }

    return await res.json();
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
