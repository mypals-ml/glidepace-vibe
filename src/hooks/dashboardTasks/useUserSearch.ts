import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitHubGraphQL } from '../../lib/githubService';
import {
  SEARCH_ASSIGNABLE_USERS_QUERY,
  SEARCH_ORG_MEMBERS_QUERY,
  SEARCH_GLOBAL_USERS_QUERY
} from '../../lib/githubQueries';
import type { User, GithubAccount, ProjectOwnerInfo } from '../../types';
import type { SelectedProjectInfo } from './types';

interface UseUserSearchProps {
  githubToken: string;
  selectedProject: SelectedProjectInfo | null;
  projectsData: ProjectOwnerInfo[];
  projectAccountId: string;
  githubAccounts: GithubAccount[];
}

/** Assignee search across repo collaborators, org members, and global users. */
export function useUserSearch({ githubToken, selectedProject, projectsData, projectAccountId, githubAccounts }: UseUserSearchProps) {
  const { t } = useTranslation();

  const fetchSearchUsers = useCallback(async (searchTerm: string, repository?: string): Promise<User[]> => {
    if (!githubToken) return [];

    try {
      const resultsMap = new Map<string, User>();

      const currentAccount = githubAccounts.find(a => a.id === projectAccountId);
      if (currentAccount && currentAccount.nodeId) {
        const currentUser: User = {
          id: currentAccount.nodeId,
          login: currentAccount.login,
          name: (currentAccount.name || currentAccount.login) + ` (${t('common.me', 'Me')})`,
          avatarUrl: currentAccount.avatarUrl,
          initials: (currentAccount.name || currentAccount.login || '??').substring(0, 2).toUpperCase(),
          avatarColor: 'bg-primary/20 text-primary',
        };
        resultsMap.set(currentUser.id, currentUser);
      }

      if (repository) {
        const [owner, name] = repository.split('/');
        if (owner && name) {
          const assignableJson = await fetchGitHubGraphQL(SEARCH_ASSIGNABLE_USERS_QUERY, { owner, name, query: searchTerm || undefined }, githubToken, {
            operationType: 'query',
            dedupeKey: `assignable:${owner}/${name}:${searchTerm || ''}`,
          });
          const assignableNodes = (assignableJson.data?.repository?.assignableUsers?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          assignableNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      const currentOwner = projectsData.find(o => o.projects.some(p => p.id === selectedProject?.id));

      if (!searchTerm && !repository && currentOwner) {
        if (currentOwner.isOrg) {
          const orgJson = await fetchGitHubGraphQL(SEARCH_ORG_MEMBERS_QUERY, { login: currentOwner.login }, githubToken, {
            operationType: 'query',
            dedupeKey: `orgMembers:${currentOwner.login}`,
          });
          const orgNodes = (orgJson.data?.organization?.membersWithRole?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          orgNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      if (searchTerm && searchTerm.length >= 2) {
        let shouldGlobalSearch = false;
        let queryStr = searchTerm;

        if (currentOwner?.isOrg) {
          shouldGlobalSearch = true;
          queryStr = `org:${currentOwner.login} ${searchTerm}`;
        } else if (currentOwner && selectedProject?.public) {
          shouldGlobalSearch = true;
          queryStr = `${searchTerm}`;
        }

        if (shouldGlobalSearch) {
          const globalJson = await fetchGitHubGraphQL(SEARCH_GLOBAL_USERS_QUERY, { searchQuery: queryStr }, githubToken, {
            operationType: 'query',
            dedupeKey: `globalUsers:${queryStr}`,
          });
          const globalNodes = (globalJson.data?.search?.nodes || []) as Array<{ id?: string, login?: string, name?: string, avatarUrl?: string }>;

          globalNodes.forEach((n, idx) => {
            if (n && n.id && !resultsMap.has(n.id)) {
              resultsMap.set(n.id, {
                id: n.id,
                login: n.login,
                name: n.name || n.login || 'Unknown User',
                avatarUrl: n.avatarUrl || '',
                initials: (n.name || n.login || '??').substring(0, 2).toUpperCase(),
                avatarColor: ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'][(resultsMap.size + idx) % 5],
              });
            }
          });
        }
      }

      return Array.from(resultsMap.values());
    } catch (e) {
      console.error('Search users failed:', e);
      return [];
    }
  }, [githubToken, projectsData, selectedProject, projectAccountId, githubAccounts, t]);

  return { fetchSearchUsers };
}
