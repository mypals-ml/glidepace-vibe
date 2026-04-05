import { GITHUB_GRAPHQL_API_URL } from './constants';
import { handleMockGraphQL, MOCK_TOKEN } from './githubMock';

export async function fetchGitHubGraphQL(query: string, variables: any = {}, token: string) {
  // Check if we should use mock data
  if (token === MOCK_TOKEN) {
    return handleMockGraphQL(query, variables);
  }

  // Real API call
  try {
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
      throw new Error(`GitHub API error: ${res.status} ${errorText}`);
    }

    return await res.json();
  } catch (error) {
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
