import { useState, useEffect, useCallback, useMemo } from 'react';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS } from '../lib/mockData';
import { MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type { GithubAccount } from '../types';

export function useDashboardAuth() {

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
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});

  const githubToken = useMemo(() => 
    githubAccounts.find(a => a.id === activeAccountId)?.token || '',
    [githubAccounts, activeAccountId]
  );

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    localStorage.setItem('active_github_account_id', id);
  }, []);

  const handleOpenAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      alert('Missing VITE_GITHUB_OAUTH_CLIENT_ID environment variable!');
      return;
    }
    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo`;
  }, []);

  const handleDisconnect = useCallback((accountId: string, onDisconnect: () => void) => {
    onDisconnect(); // Clear project-related states in the provider/projects hook

    const nextAccounts = githubAccounts.filter(a => a.id !== accountId);
    setGithubAccounts(nextAccounts);
    localStorage.removeItem('github_accounts');
    if (nextAccounts.length > 0) {
      localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
    }

    if (activeAccountId === accountId) {
      const nextActive = nextAccounts.length > 0 ? nextAccounts[0].id : '';
      setActiveAccountId(nextActive);
    }
  }, [githubAccounts, activeAccountId, setActiveAccountId]);

  const handleAddAccountByToken = useCallback(async (token: string, onOpenProject: () => void, onCloseModals: () => void) => {
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
        onCloseModals();
        if (localStorage.getItem('pending_open_project') === 'true') {
          localStorage.removeItem('pending_open_project');
          onOpenProject();
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
        nodeId: userData.node_id,
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
      onCloseModals();

      if (localStorage.getItem('pending_open_project') === 'true') {
        localStorage.removeItem('pending_open_project');
        onOpenProject();
      }

      return { success: true };
    } catch (e: unknown) {
      const error = e as Error;
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [setActiveAccountId]);

  // Auth: OAuth callback
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
              nodeId: data.user.node_id,
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
          }
        } catch (e) {
          console.error('Failed to authenticate:', e);
        } finally {
          setIsLoadingAuth(false);
        }
      }
    };
    handleAuthCallback();
  }, [githubToken, setActiveAccountId]);

  const checkAppInstallation = useCallback(async (login: string) => {
    if (!login || isAppInstalled[login] !== undefined) return;
    try {
      const res = await fetch(`/api/check-github-app-installation?login=${login}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.installed === 'boolean') {
        setIsAppInstalled(prev => ({ ...prev, [login]: data.installed }));
      }
    } catch (e) {
      console.error('Failed to check app installation:', e);
    }
  }, [isAppInstalled]);

  return {
    githubAccounts,
    setGithubAccounts,
    activeAccountId,
    setActiveAccountId,
    githubToken,
    isLoadingAuth,
    isAppInstalled,
    setIsAppInstalled,
    checkAppInstallation,
    handleOpenAuth,
    handleDisconnect,
    handleAddAccountByToken,
  };
}
