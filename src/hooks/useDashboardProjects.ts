import { useState, useCallback } from 'react';
import { USE_MOCK_DATA, MOCK_PROJECTS } from '../lib/mockData';
import { fetchGitHubGraphQL } from '../lib/githubService';
import { GET_USER_PROJECTS_QUERY } from '../lib/githubQueries';
import { MOCK_TOKEN } from '../lib/githubMock';
import type { ProjectOwnerInfo, GitHubProject, ProjectHistoryItem, SortMethod } from '../types';

interface UseDashboardProjectsProps {
  githubToken: string;
  activeAccountId: string;
  setIsProjectModalOpen: (open: boolean) => void;
  updateSyncTime: () => void;
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
}

export function useDashboardProjects({
  githubToken,
  activeAccountId,
  setIsProjectModalOpen,
  updateSyncTime,
  fetchProjectTasks,
}: UseDashboardProjectsProps) {

  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>('');
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
  const [projectHistory, setHistory] = useState<ProjectHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('project_history') || '[]');
    } catch {
      return [];
    }
  });
  const [sortMethod, setSortMethod] = useState<SortMethod>('recent');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  const setProjectHistory = useCallback((history: ProjectHistoryItem[]) => {
    setHistory(history);
    localStorage.setItem('project_history', JSON.stringify(history));
  }, []);

  const fetchProjects = useCallback(async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const json = await fetchGitHubGraphQL(GET_USER_PROJECTS_QUERY, {}, token);

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
    const isMockProject = isMockAccount;
    const tokenToUse = forceToken || (isMockProject ? MOCK_TOKEN : githubToken);

    if (tokenToUse) {
      fetchProjectTasks(id, tokenToUse);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, lastOpened: Date.now() };
    const nextHistory = [newItem, ...projectHistory.filter(item => item.id !== id)].slice(0, 20);
    setProjectHistory(nextHistory);
  }, [githubToken, fetchProjectTasks, updateSyncTime, projectsData, activeAccountId, projectHistory, setProjectHistory, setIsProjectModalOpen]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    const nextHistory = projectHistory.filter(item => item.id !== id);
    setProjectHistory(nextHistory);
  }, [projectHistory, setProjectHistory]);

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
    isRefreshing,
    fetchProjects,
    handleSelectRealProject,
    handleRemoveFromHistory,
    groupHistoryByDate,
    sortProjects,
  };
}
