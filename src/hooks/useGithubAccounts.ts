import { useCallback, useEffect, useState } from 'react';
import { GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { validateUserToken } from '../lib/githubApi';
import { MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import { USE_MOCK_DATA, MOCK_ACCOUNTS } from '../lib/mockData';
import type { GithubAccount } from '../types';

export interface UseGithubAccountsArgs {
  activeTabLogin: string;
  onAuthSuccess: () => void;
  onApiError: (msg: string | null) => void;
}

export function useGithubAccounts({
  activeTabLogin,
  onAuthSuccess,
  onApiError,
}: UseGithubAccountsArgs) {
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>(() => {
    if (USE_MOCK_DATA) return MOCK_ACCOUNTS;
    try {
      return JSON.parse(localStorage.getItem('github_accounts') || '[]');
    } catch {
      return [];
    }
  });
  const [activeAccountId, setActiveAccountIdState] = useState<string>(
    () => USE_MOCK_DATA ? MOCK_ACCOUNTS[0].id : (localStorage.getItem('active_github_account_id') || ''),
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  const githubToken = githubAccounts.find(a => a.id === activeAccountId)?.token || '';

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    localStorage.setItem('active_github_account_id', id);
  }, []);

  const persistAccount = useCallback((newAccount: GithubAccount) => {
    setGithubAccounts(prev => {
      const filtered = prev.filter(acc => acc.id !== newAccount.id);
      const nextAccounts = [...filtered, newAccount];
      localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
      return nextAccounts;
    });
    setActiveAccountId(newAccount.id);
  }, [setActiveAccountId]);

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
            persistAccount({
              id: data.user.id,
              login: data.user.login,
              name: data.user.name,
              avatarUrl: data.user.avatar_url,
              token: data.access_token,
            });
            window.history.replaceState({}, document.title, window.location.pathname);
            onAuthSuccess();
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
  }, [githubToken, persistAccount, onAuthSuccess]);

  // ---- Check GitHub App installation for the currently viewed owner ----

  useEffect(() => {
    if (!activeTabLogin) return;
    if (isAppInstalled[activeTabLogin] !== undefined) return; // Already checked

    const checkAppInstallation = async () => {
      try {
        const res = await fetch(`/api/check-github-app-installation?login=${activeTabLogin}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.installed === 'boolean') {
          setIsAppInstalled(prev => ({ ...prev, [activeTabLogin]: data.installed }));
        }
      } catch (e) {
        console.error('Failed to check app installation:', e);
      }
    };
    checkAppInstallation();
  }, [activeTabLogin, isAppInstalled]);

  // ---- Actions ----

  const handleOpenAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      alert('Missing VITE_GITHUB_OAUTH_CLIENT_ID environment variable!');
      return;
    }
    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project,repo`;
  }, []);

  const handleAddAccountByToken = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Token is required' };

    setIsLoadingAuth(true);
    onApiError(null);
    try {
      if (token === MOCK_TOKEN) {
        persistAccount(MOCK_ACCOUNTS_DATA[0]);
        onAuthSuccess();
        return { success: true };
      }

      const validation = await validateUserToken(token);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const user = validation.user;
      persistAccount({
        id: user.id.toString(),
        login: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        token,
      });
      onAuthSuccess();

      return { success: true };
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Failed to add account by token:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [persistAccount, onAuthSuccess, onApiError]);

  return {
    githubAccounts,
    setGithubAccounts,
    activeAccountId,
    setActiveAccountId,
    githubToken,
    isLoadingAuth,
    isAppInstalled,
    isRefreshing,
    setIsRefreshing,
    handleOpenAuth,
    handleAddAccountByToken,
  };
}
