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
    () => {
      if (USE_MOCK_DATA) return MOCK_ACCOUNTS[0].id;
      const urlParams = new URLSearchParams(window.location.search);
      const urlAccount = urlParams.get('account');
      return urlAccount || sessionStorage.getItem('active_github_account_id') || localStorage.getItem('active_github_account_id') || '';
    }
  );

  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});

  const githubToken = useMemo(() => 
    githubAccounts.find(a => a.id === activeAccountId)?.token || '',
    [githubAccounts, activeAccountId]
  );

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    
    // Update Storage
    if (id) {
      sessionStorage.setItem('active_github_account_id', id);
      localStorage.setItem('active_github_account_id', id);
    } else {
      sessionStorage.removeItem('active_github_account_id');
      localStorage.removeItem('active_github_account_id');
    }

    // Sync to URL
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('account', id);
    } else {
      url.searchParams.delete('account');
    }
    window.history.replaceState({}, document.title, url.toString());
  }, []);

  const handleOpenAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      alert('Missing VITE_GITHUB_OAUTH_CLIENT_ID environment variable!');
      return;
    }

    // Phase 0: Context Preservation (Pre-Auth)
    const urlParams = new URLSearchParams(window.location.search);
    const context = {
      project_id: urlParams.get('project'),
      account_id: urlParams.get('account')
    };
    localStorage.setItem('auth_return_context', JSON.stringify(context));

    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo&prompt=consent`;
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

  const handleAddAccountByToken = useCallback(async (token: string, onOpenProject: (token: string, id: string) => void, onCloseModals: () => void) => {
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
        // Phase 1: Persistence Done
        // Returning the new account as a signal to the caller (DashboardProvider)
        return { success: true, account: mockAccount };
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
      // Phase 1: Persistence Done
      // Returning the new account as a signal to the caller (DashboardProvider)
      return { success: true, account: newAccount };
    } catch (e: unknown) {
      const error = e as Error;
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [setActiveAccountId]);

  // Auth: OAuth callback
  const useOAuthCallback = (onOpenProject: (token: string, id: string) => void) => {
    useEffect(() => {
      const handleAuthCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          setIsLoadingAuth(true);
          try {
            const res = await fetch(`/api/github-oauth-callback?code=${code}`, {
              headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (data.access_token && data.user) {
              const newAccountId = data.user.id.toString();
              // Note: Use a ref-like check or compare against the current state
              // Since this is inside useEffect, we should be careful with stale githubAccounts
              // But setGithubAccounts functional update is safe for the list itself.
              
              const newAccount: GithubAccount = {
                id: newAccountId,
                nodeId: data.user.node_id,
                login: data.user.login,
                name: data.user.name,
                avatarUrl: data.user.avatar_url,
                token: data.access_token,
              };

              setGithubAccounts(prev => {
                const isAlreadyPresent = prev.some(acc => acc.id === newAccount.id);
                if (isAlreadyPresent) {
                  setAuthError(`Account @${newAccount.login} is already connected. To add a different account, please sign out of GitHub.com first.`);
                } else {
                  setAuthError(null);
                }
                
                const filtered = prev.filter(acc => acc.id !== newAccount.id);
                const nextAccounts = [...filtered, newAccount];
                localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
                return nextAccounts;
              });
              
              // Check if we should open the project modal after login
              if (sessionStorage.getItem('pending_open_project') === 'true' || localStorage.getItem('pending_open_project') === 'true') {
                sessionStorage.removeItem('pending_open_project');
                localStorage.removeItem('pending_open_project');
                
                // Note: We don't call setActiveAccountId here anymore.
                // DashboardProvider will handle the orchestration.
                onOpenProject(data.access_token, newAccountId);
              }
            }
          } catch (e) {
            console.error('Failed to authenticate:', e);
          } finally {
            setIsLoadingAuth(false);
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.toString());
          }
        }
      };
      handleAuthCallback();
    }, [onOpenProject]);
  };

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

  const getTokenById = useCallback((id: string | undefined) => {
    if (!id) return '';
    return githubAccounts.find(a => a.id === id)?.token || '';
  }, [githubAccounts]);

  // Sync initial state to URL if missing
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeAccountId && !url.searchParams.has('account')) {
      url.searchParams.set('account', activeAccountId);
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [activeAccountId]);

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
    useOAuthCallback,
    authError,
    setAuthError,
    getTokenById,
  };
}
