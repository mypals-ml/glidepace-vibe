import { useState, useEffect, useCallback } from 'react';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS } from '../lib/mockData';
import { MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type { GithubAccount } from '../types';

export interface UseDashboardAuthReturn {
  githubAccounts: GithubAccount[];
  setGithubAccounts: React.Dispatch<React.SetStateAction<GithubAccount[]>>;
  activeAccountId: string;
  setActiveAccountId: (id: string) => void;
  setActiveAccountIdState: React.Dispatch<React.SetStateAction<string>>;
  githubToken: string;
  isLoadingAuth: boolean;
  isRefreshing: Record<string, boolean>;
  setIsRefreshing: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleOpenAuth: () => void;
  handleAddAccountByToken: (token: string) => Promise<{ success: boolean; error?: string }>;
}

export function useDashboardAuth(deps: {
  setIsProjectModalOpen: (open: boolean) => void;
  setIsAccountModalOpen: (open: boolean) => void;
  setIsPatModalOpen: (open: boolean) => void;
}): UseDashboardAuthReturn {
  const {
    setIsProjectModalOpen,
    setIsAccountModalOpen,
    setIsPatModalOpen,
  } = deps;

  // ---- Auth state ----
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>(() => {
    if (USE_MOCK_DATA) return MOCK_ACCOUNTS;
    try {
      return JSON.parse(localStorage.getItem('github_accounts') || '[]');
    } catch {
      return [];
    }
  });
  const [activeAccountId, setActiveAccountIdState] = useState<string>(
    () => USE_MOCK_DATA ? MOCK_ACCOUNTS[0].id : (localStorage.getItem('active_github_account_id') || '')
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  const githubToken = githubAccounts.find(a => a.id === activeAccountId)?.token || '';

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    localStorage.setItem('active_github_account_id', id);
  }, []);

  // ---- OAuth callback ----
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code && !githubToken) {
        setIsLoadingAuth(true);
        try {
          const res = await fetch(`/api/github-oauth-callback?code=${code}`, {
            headers: { Accept: 'application/json' },
          });
          const data = await res.json();
          if (data.access_token && data.user) {
            const newAccount: GithubAccount = {
              id: data.user.id,
              login: data.user.login,
              name: data.user.name,
              avatarUrl: data.user.avatar_url,
              token: data.access_token,
            };
            setGithubAccounts(prev => {
              const filtered = prev.filter(acc => acc.id !== newAccount.id);
              const nextAccounts = [...filtered, newAccount];
              localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
              return nextAccounts;
            });
            setActiveAccountId(newAccount.id);
            window.history.replaceState({}, document.title, window.location.pathname);
            if (localStorage.getItem('pending_open_project') === 'true') {
              localStorage.removeItem('pending_open_project');
              setIsProjectModalOpen(true);
            }
          } else {
            console.error('OAuth Error:', data.error);
          }
        } catch (e) {
          console.error('Failed to authenticate:', e);
        } finally {
          setIsLoadingAuth(false);
        }
      }
    };
    handleAuthCallback();
  }, [githubToken, setActiveAccountId, setIsProjectModalOpen]);

  // ---- Auth handlers ----
  const handleOpenAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      alert('Missing VITE_GITHUB_OAUTH_CLIENT_ID environment variable!');
      return;
    }
    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo`;
  }, []);

  const handleAddAccountByToken = useCallback(async (token: string) => {
    if (!token) return { success: false, error: 'Token is required' };

    setIsLoadingAuth(true);
    try {
      if (token === MOCK_TOKEN) {
        const mockAccount = MOCK_ACCOUNTS_DATA[0];
        setGithubAccounts(prev => {
          const filtered = prev.filter(acc => acc.id !== mockAccount.id);
          const nextAccounts = [...filtered, mockAccount];
          localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
          return nextAccounts;
        });
        setActiveAccountId(mockAccount.id);
        setIsPatModalOpen(false);
        setIsAccountModalOpen(false);
        if (localStorage.getItem('pending_open_project') === 'true') {
          localStorage.removeItem('pending_open_project');
          setIsProjectModalOpen(true);
        }
        return { success: true };
      }

      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        return { success: false, error: errorData.message || 'Invalid token' };
      }

      const userData = await res.json();
      const newAccount: GithubAccount = {
        id: userData.id.toString(),
        login: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        token: token,
      };

      setGithubAccounts(prev => {
        const filtered = prev.filter(acc => acc.id !== newAccount.id);
        const nextAccounts = [...filtered, newAccount];
        localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
        return nextAccounts;
      });
      setActiveAccountId(newAccount.id);
      setIsPatModalOpen(false);
      setIsAccountModalOpen(false);

      if (localStorage.getItem('pending_open_project') === 'true') {
        localStorage.removeItem('pending_open_project');
        setIsProjectModalOpen(true);
      }

      return { success: true };
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Failed to add account by token:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [setActiveAccountId, setIsProjectModalOpen, setIsAccountModalOpen, setIsPatModalOpen]);

  return {
    githubAccounts,
    setGithubAccounts,
    activeAccountId,
    setActiveAccountId,
    setActiveAccountIdState,
    githubToken,
    isLoadingAuth,
    isRefreshing,
    setIsRefreshing,
    handleOpenAuth,
    handleAddAccountByToken,
  };
}
