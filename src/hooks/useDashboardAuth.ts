import { useState, useEffect, useCallback, useMemo } from 'react';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS } from '../lib/mockData';
import { MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import type { GithubAccount } from '../types';

export function useDashboardAuth() {

  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>(() => {
    if (USE_MOCK_DATA) {
      console.log('[Auth] Initializing with MOCK accounts:', MOCK_ACCOUNTS.map(a => a.login));
      return MOCK_ACCOUNTS;
    }
    try {
      const saved = localStorage.getItem('github_accounts');
      const parsed = JSON.parse(saved || '[]');
      console.log('[Auth] Initializing with SAVED accounts from localStorage:', parsed.map((a: GithubAccount) => a.login));
      return parsed;
    } catch {
      console.log('[Auth] Initializing with EMPTY accounts (parse failed)');
      return [];
    }
  });

  const [browsingAccountId, setBrowsingAccountId] = useState<string>(
    () => {
      if (USE_MOCK_DATA) return MOCK_ACCOUNTS[0].id;
      const urlParams = new URLSearchParams(window.location.search);
      const urlAccount = urlParams.get('account');
      return urlAccount || sessionStorage.getItem('browsing_github_account_id') || localStorage.getItem('browsing_github_account_id') || '';
    }
  );

  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});

  const browsingToken = useMemo(() => 
    githubAccounts.find(a => a.id === browsingAccountId)?.token || '',
    [githubAccounts, browsingAccountId]
  );

  // Diagnostic: Log whenever githubAccounts state actually changes in React
  useEffect(() => {
    console.log('[Auth] githubAccounts state has changed! Current list:', githubAccounts.map(a => a.login));
  }, [githubAccounts]);

  // Sync browsingAccountId to storage (no URL sync here)
  // URL sync is now project-driven.

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
      account_id: urlParams.get('account'),
      new_account_id: null
    };
    console.log('[Auth] Initiating OAuth redirect. Saving context:', context);
    localStorage.setItem('auth_return_context', JSON.stringify(context));

    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo&prompt=consent`;
  }, []);

  const handleDisconnect = useCallback((accountId: string, onDisconnect: () => void) => {
    onDisconnect(); // Clear project-related states in the provider/projects hook

    const nextAccounts = githubAccounts.filter(a => a.id !== accountId);
    console.log('[Auth] State Update (Disconnect): New account list:', nextAccounts.map(a => a.login));
    console.log('[Auth] handleDisconnect: removing account:', accountId);
    setGithubAccounts(nextAccounts);
    localStorage.removeItem('github_accounts');
    if (nextAccounts.length > 0) {
      console.log('[Auth] handleDisconnect: Persisting new account list to storage');
      localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
    }

    if (browsingAccountId === accountId) {
      const nextBrowsing = nextAccounts.length > 0 ? nextAccounts[0].id : '';
      setBrowsingAccountId(nextBrowsing);
    }
  }, [githubAccounts, browsingAccountId]);

  const handleAddAccountByToken = useCallback(async (token: string): Promise<{ success: boolean; account?: GithubAccount; error?: string }> => {
    console.log('[Auth] Hook: handleAddAccountByToken fetching user data...');
    if (!token) return { success: false, error: 'Token is required' };

    setIsLoadingAuth(true);
    try {
      if (token === MOCK_TOKEN) {
        const mockAccount = MOCK_ACCOUNTS_DATA[0];
        console.log('[Auth] handleAddAccountByToken (Mock): Triggering setGithubAccounts');
        setGithubAccounts(prev => {
          const filtered = prev.filter(acc => acc.id !== mockAccount.id);
          const nextAccounts = [...filtered, mockAccount];
          console.log('[Auth] State Update (Mock PAT): Saving accounts to list:', nextAccounts.map(a => a.login));
          console.log('[Auth] handleAddAccountByToken (Mock): Persisting account to storage');
          localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
          return nextAccounts;
        });
        setBrowsingAccountId(mockAccount.id);
        return { success: true, account: mockAccount };
      }

      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const userData = await response.json();
      const newAccount: GithubAccount = {
        id: String(userData.id),
        nodeId: userData.node_id,
        login: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        token: token,
      };

      console.log('[Auth] handleAddAccountByToken: Triggering setGithubAccounts');
      setGithubAccounts(prev => {
        const nextAccounts = [...prev.filter(a => a.id !== newAccount.id), newAccount];
        console.log('[Auth] State Update (PAT): Saving accounts to list:', nextAccounts.map(a => a.login));
        console.log('[Auth] handleAddAccountByToken: Persisting account to storage');
        localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
        return nextAccounts;
      });
      
      console.log('[Auth] Hook: Account added successfully:', newAccount.login);
      setBrowsingAccountId(newAccount.id);

      return { success: true, account: newAccount };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Add account by token failed:', error);
      setAuthError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const updateAuthReturnContext = useCallback((newAccountId: string) => {
    const saved = localStorage.getItem('auth_return_context');
    if (saved) {
      try {
        const context = JSON.parse(saved);
        context.new_account_id = newAccountId;
        console.log('[Auth] updateAuthReturnContext: Updating context with new_account_id:', newAccountId, 'Old context:', context);
        localStorage.setItem('auth_return_context', JSON.stringify(context));
      } catch (e) {
        console.error('Failed to update auth return context:', e);
      }
    }
  }, []);

  const useOAuthCallback = (onOpenProject: () => void) => {
    useEffect(() => {
      const handleAuthCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        console.log('[Auth] handleAuthCallback checking URL. Code present:', code, 'URL:', window.location.href);

        if (code) {
          console.log('[Auth] OAuth Callback detected with code');
          setIsLoadingAuth(true);
          try {
            const res = await fetch(`/api/github-oauth-callback?code=${code}`, {
              headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            console.log('[Auth] OAuth API Response received:', { 
              hasToken: !!data.access_token, 
              hasUser: !!data.user,
              userId: data.user?.id 
            });

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

              console.log('[Auth] handleAuthCallback: Success! Triggering setGithubAccounts');
              setGithubAccounts(prev => {
                const isAlreadyPresent = prev.some(acc => acc.id === newAccount.id);
                if (isAlreadyPresent) {
                  setAuthError(`Account @${newAccount.login} is already connected. To add a different account, please sign out of GitHub.com first.`);
                } else {
                  setAuthError(null);
                }
                
                const filtered = prev.filter(acc => acc.id !== newAccount.id);
                const nextAccounts = [...filtered, newAccount];
                console.log('[Auth] State Update: Saving accounts to list:', nextAccounts.map(a => a.login));
                console.log('[Auth] handleAuthCallback: Persisting new account list to storage');
                localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
                return nextAccounts;
              });
              
              console.log('[Auth] handleAuthCallback: Success! Calling updateAuthReturnContext for account:', newAccountId);
              updateAuthReturnContext(newAccountId);
              console.log('[Auth] OAuth Successful. Calling onOpenProject signal.');
              onOpenProject();
            }
          } catch (e) {
            console.error('[Auth] Failed to authenticate:', e);
            onOpenProject();
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

  // Sync browsingAccountId to storage (no URL sync here)
  useEffect(() => {
    if (browsingAccountId) {
      localStorage.setItem('browsing_github_account_id', browsingAccountId);
    }
  }, [browsingAccountId]);

  return {
    githubAccounts,
    setGithubAccounts,
    authError,
    setAuthError,
    browsingAccountId,
    setBrowsingAccountId,
    browsingToken,
    isLoadingAuth,
    isAppInstalled,
    setIsAppInstalled,
    checkAppInstallation,
    handleOpenAuth,
    handleDisconnect,
    handleAddAccountByToken,
    useOAuthCallback,
    getTokenById,
    updateAuthReturnContext,
  };
}
