import { useState, useEffect, useCallback } from 'react';
import { USE_MOCK_DATA, MOCK_ACCOUNTS } from '../lib/mockData';
import { DUMMY_PROJECT_ID, MOCK_ACCOUNTS_DATA, MOCK_TOKEN } from '../lib/githubMock';
import { fetchUserProjectsGQL } from '../lib/githubOperations';
import type { Task, GithubAccount, ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod } from '../types';

export interface UseDashboardProjectsReturn {
  projectsData: ProjectOwnerInfo[];
  activeTabLogin: string;
  setActiveTabLogin: (login: string) => void;
  isAppInstalled: Record<string, boolean>;
  sortMethod: SortMethod;
  setSortMethod: (method: SortMethod) => void;
  fetchProjects: (token: string, accountId: string, forceModal?: boolean) => Promise<void>;
  handleSelectRealProject: (id: string, title: string, isPublic?: boolean, forceToken?: string) => void;
  handleRemoveFromHistory: (id: string) => void;
  handleOpenProjectClick: () => void;
  handleOpenDummyProject: () => void;
  sortProjects: (projects: GitHubProject[]) => GitHubProject[];
  groupHistoryByDate: () => Record<string, ProjectHistoryItem[]>;
}

export function useDashboardProjects(deps: {
  githubToken: string;
  githubAccounts: GithubAccount[];
  activeAccountId: string;
  setSelectedProject: (val: { id: string; title: string; public: boolean } | null) => void;
  hasProject: boolean;
  setHasProject: (val: boolean) => void;
  projectHistory: ProjectHistoryItem[];
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryItem[]>>;
  projectsData: ProjectOwnerInfo[];
  setProjectsData: React.Dispatch<React.SetStateAction<ProjectOwnerInfo[]>>;
  apiError: string | null;
  setApiError: (error: string | null) => void;
  setIsProjectModalOpen: (open: boolean) => void;
  setIsRefreshing: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setGithubAccounts: React.Dispatch<React.SetStateAction<GithubAccount[]>>;
  setActiveAccountId: (id: string) => void;
  handleOpenAuth: () => void;
  updateSyncTime: () => void;
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setSelectedTaskId: (id: string | null) => void;
  setProjectStatusOptions: React.Dispatch<React.SetStateAction<string[]>>;
}): UseDashboardProjectsReturn {
  const {
    githubToken,
    githubAccounts,
    activeAccountId,
    setSelectedProject,
    setHasProject,
    projectHistory,
    setProjectHistory,
    projectsData,
    setProjectsData,
    setApiError,
    setIsProjectModalOpen,
    setIsRefreshing,
    setGithubAccounts,
    setActiveAccountId,
    handleOpenAuth,
    updateSyncTime,
    fetchProjectTasks,
    setTasks,
    setSelectedTaskId,
    setProjectStatusOptions,
  } = deps;

  // ---- Project-specific state ----
  const [activeTabLogin, setActiveTabLogin] = useState<string>(USE_MOCK_DATA ? MOCK_ACCOUNTS[0].login : '');
  const [sortMethod, setSortMethod] = useState<SortMethod>('recent');
  const [isAppInstalled, setIsAppInstalled] = useState<Record<string, boolean>>({});

  // ---- Check app installation ----
  useEffect(() => {
    if (activeTabLogin) {
      if (isAppInstalled[activeTabLogin] !== undefined) return;

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
    }
  }, [activeTabLogin, isAppInstalled]);

  // ---- Helpers ----

  const groupHistoryByDate = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - 7 * 86400000;

    const groups: Record<string, ProjectHistoryItem[]> = {
      today: [],
      yesterday: [],
      last7Days: [],
      earlier: [],
    };

    projectHistory.forEach(item => {
      if (item.lastOpened >= today) groups.today.push(item);
      else if (item.lastOpened >= yesterday) groups.yesterday.push(item);
      else if (item.lastOpened >= last7Days) groups.last7Days.push(item);
      else groups.earlier.push(item);
    });

    return groups;
  }, [projectHistory]);

  const sortProjects = useCallback((projects: GitHubProject[]): GitHubProject[] => {
    const sorted = [...projects];
    switch (sortMethod) {
      case 'oldest':
        return sorted.reverse();
      case 'nameAZ':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'nameZA':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'recent':
      default:
        return sorted;
    }
  }, [sortMethod]);

  // ---- API: fetch projects ----

  const fetchProjects = useCallback(async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const json = await fetchUserProjectsGQL(token);

      if (json.errors) {
        console.error('GraphQL Errors:', json.errors);
        setApiError(json.errors.map((e: { message: string }) => e.message).join(', '));
      } else {
        setApiError(null);
      }

      const viewer = json.data?.viewer;
      if (viewer) {
        const owners: ProjectOwnerInfo[] = [];
        owners.push({
          login: viewer.login,
          isOrg: false,
          databaseId: viewer.databaseId,
          projects: (viewer.projectsV2?.nodes || []).filter(Boolean),
        });

        const orgs = viewer.organizations?.nodes || [];
        for (const org of orgs) {
          if (!org || !org.login) continue;
          owners.push({
            login: org.login,
            isOrg: true,
            databaseId: org.databaseId,
            projects: (org.projectsV2?.nodes || []).filter(Boolean),
          });
        }
        setProjectsData(owners);
        setActiveTabLogin(prev => {
          if (prev && owners.some(o => o.login === prev)) {
            return prev;
          }
          return viewer.login;
        });
        updateSyncTime();
      }
      if (forceModal) {
        setIsProjectModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to fetch user projects:', e);
    } finally {
      setIsRefreshing(prev => ({ ...prev, [accountId]: false }));
    }
  }, [updateSyncTime, setIsRefreshing, setIsProjectModalOpen, setApiError]);

  // ---- Action handlers ----

  const handleOpenProjectClick = useCallback(() => {
    if (githubAccounts.length > 0) {
      setIsProjectModalOpen(true);
    } else {
      localStorage.setItem('pending_open_project', 'true');
      handleOpenAuth();
    }
  }, [githubAccounts.length, handleOpenAuth, setIsProjectModalOpen]);

  const handleSelectRealProject = useCallback((id: string, title: string, isPublic?: boolean, forceToken?: string) => {
    setIsProjectModalOpen(false);

    let finalPublic = isPublic;
    if (finalPublic === undefined) {
      const found = projectsData.flatMap(o => o.projects).find(p => p.id === id);
      finalPublic = found ? found.public : false;
    }

    const project = { id, title, public: finalPublic };
    setSelectedProject(project);
    setHasProject(true);
    setTasks([]);
    setSelectedTaskId(null);
    setProjectStatusOptions([]);

    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');

    const isMockAccount = activeAccountId === 'mock-1';
    const isMockProject = id === DUMMY_PROJECT_ID || isMockAccount;
    const tokenToUse = forceToken || (isMockProject ? MOCK_TOKEN : githubToken);

    if (tokenToUse) {
      fetchProjectTasks(id, tokenToUse);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, lastOpened: Date.now() };
    setProjectHistory(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const nextHistory = [newItem, ...filtered].slice(0, 20);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [githubToken, fetchProjectTasks, updateSyncTime, projectsData, activeAccountId, setIsProjectModalOpen, setSelectedProject, setHasProject, setTasks, setSelectedTaskId, setProjectStatusOptions, setProjectHistory]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    setProjectHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [setProjectHistory]);

  const handleOpenDummyProject = useCallback(() => {
    const mockAccount = MOCK_ACCOUNTS_DATA[0];
    setGithubAccounts(prev => {
      if (prev.find(a => a.id === mockAccount.id)) return prev;
      const next = [...prev, mockAccount];
      localStorage.setItem('github_accounts', JSON.stringify(next));
      return next;
    });

    setActiveAccountId(mockAccount.id);
    handleSelectRealProject(DUMMY_PROJECT_ID, 'Demo: Product Roadmap 2024', true, mockAccount.token);
  }, [handleSelectRealProject, setActiveAccountId, setGithubAccounts]);

  return {
    projectsData,
    activeTabLogin,
    setActiveTabLogin,
    isAppInstalled,
    sortMethod,
    setSortMethod,
    fetchProjects,
    handleSelectRealProject,
    handleRemoveFromHistory,
    handleOpenProjectClick,
    handleOpenDummyProject,
    sortProjects,
    groupHistoryByDate,
  };
}
