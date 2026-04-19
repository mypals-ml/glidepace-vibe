import { useState, useCallback } from 'react';
import { USE_MOCK_DATA, MOCK_PROJECTS } from '../../lib/mockData';
import { DUMMY_PROJECT_ID, MOCK_TOKEN } from '../../lib/githubMock';
import type { ProjectOwnerInfo, ProjectHistoryItem, GitHubProject, SortMethod } from '../../types';
import { fetchUserProjectsApi } from '../../services/githubApiService';

interface UseDashboardProjectsProps {
  githubToken: string;
  activeAccountId: string;
  updateSyncTime: () => void;
  setIsProjectModalOpen: (open: boolean) => void;
}

export function useDashboardProjects({
  githubToken,
  activeAccountId,
  updateSyncTime,
  setIsProjectModalOpen,
}: UseDashboardProjectsProps) {
  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>(USE_MOCK_DATA ? (MOCK_PROJECTS[0]?.login || '') : '');
  const [selectedProject, setSelectedProject] = useState<{ id: string; title: string; public: boolean } | null>(() => {
    try {
      const saved = localStorage.getItem('selected_project');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [hasProject, setHasProject] = useState(() => {
    return !!localStorage.getItem('selected_project_type') || !!localStorage.getItem('selected_project');
  });
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('project_history') || '[]');
    } catch {
      return [];
    }
  });
  const [sortMethod, setSortMethod] = useState<SortMethod>('recent');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean | undefined>>({});

  const fetchProjects = useCallback(async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const json = await fetchUserProjectsApi(token);

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
  }, [updateSyncTime, setIsProjectModalOpen]);

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
    
    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');

    const isMockAccount = activeAccountId === 'mock-1';
    const isMockProject = id === DUMMY_PROJECT_ID || isMockAccount;
    const tokenToUse = forceToken || (isMockProject ? MOCK_TOKEN : githubToken);

    if (tokenToUse) {
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, lastOpened: Date.now() };
    setProjectHistory(prev => {
      const filtered = prev.filter(item => item.id !== id);
      const nextHistory = [newItem, ...filtered].slice(0, 20);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [githubToken, updateSyncTime, projectsData, activeAccountId, setIsProjectModalOpen]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    setProjectHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('project_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, []);

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

  return {
    projectsData,
    setProjectsData,
    activeTabLogin,
    setActiveTabLogin,
    selectedProject,
    setSelectedProject,
    hasProject,
    setHasProject,
    projectHistory,
    setProjectHistory,
    sortMethod,
    setSortMethod,
    apiError,
    setApiError,
    fetchProjects,
    handleSelectRealProject,
    handleRemoveFromHistory,
    sortProjects,
    groupHistoryByDate,
    isRefreshingProjects: isRefreshing,
  };
}
