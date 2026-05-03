import { useState, useCallback, useEffect } from 'react';
import { USE_MOCK_DATA, MOCK_PROJECTS } from '../lib/mockData';
import { fetchGitHubGraphQL } from '../lib/githubService';
import { GET_USER_PROJECTS_QUERY } from '../lib/githubQueries';
import { MOCK_TOKEN } from '../lib/githubMock';
import type { ProjectOwnerInfo, GitHubProject, ProjectHistoryItem, SortMethod } from '../types';

interface UseDashboardProjectsProps {
  githubToken: string;
  browsingAccountId: string;
  setIsProjectModalOpen: (open: boolean) => void;
  updateSyncTime: () => void;
  fetchProjectTasks: (projectId: string, token: string) => Promise<void>;
}

export function useDashboardProjects({
  githubToken,
  browsingAccountId,
  setIsProjectModalOpen,
  updateSyncTime,
  fetchProjectTasks,
}: UseDashboardProjectsProps) {

  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>('');
  const [selectedProject, setSelectedProjectState] = useState<{ id: string; title: string; public: boolean; accountId?: string } | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlProjectId = urlParams.get('project');
      const urlAccountId = urlParams.get('account');
      if (urlProjectId) {
        return { id: urlProjectId, title: 'Loading...', public: false, accountId: urlAccountId || undefined };
      }
      const saved = sessionStorage.getItem('selected_project') || localStorage.getItem('selected_project');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setSelectedProject = useCallback((project: { id: string; title: string; public: boolean; accountId?: string } | null) => {
    setSelectedProjectState(project);
    
    // Update Storage
    if (project) {
      const str = JSON.stringify(project);
      sessionStorage.setItem('selected_project', str);
      localStorage.setItem('selected_project', str);
    } else {
      sessionStorage.removeItem('selected_project');
      localStorage.removeItem('selected_project');
    }

    // Sync to URL
    const url = new URL(window.location.href);
    if (project) {
      url.searchParams.set('project', project.id);
      if (project.accountId) {
        url.searchParams.set('account', project.accountId);
      }
    } else {
      url.searchParams.delete('project');
    }
    window.history.replaceState({}, document.title, url.toString());
  }, []);

  const [hasProject, setHasProjectState] = useState(() => {
    return !!sessionStorage.getItem('selected_project_type') || 
           !!localStorage.getItem('selected_project_type') || 
           !!sessionStorage.getItem('selected_project') || 
           !!localStorage.getItem('selected_project');
  });

  const setHasProject = useCallback((has: boolean) => {
    setHasProjectState(has);
    // Note: We don't explicitly set storage here as hasProject is usually a derivative of selectedProject
    // But we keep the setter for compatibility with the hook's interface
  }, []);
  const [projectHistory, setHistory] = useState<ProjectHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('project_history');
      if (!saved) return [];
      const history = JSON.parse(saved);
      // Migration: Ensure items have accountId (fallback to active if missing)
      return history.map((item: ProjectHistoryItem) => ({
        ...item,
        accountId: item.accountId || ''
      }));
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

  // ID Migration: Handle transitions between GitHub ID formats (legacy vs next-gen)
  // This effect runs whenever projectsData is updated, ensuring stale IDs in localStorage are corrected.
  useEffect(() => {
    if (projectsData.length === 0) return;

    const allProjects = projectsData.flatMap(o => o.projects);
    
    if (selectedProject) {
      const matchById = allProjects.find(p => p.id === selectedProject.id);
      const matchByTitle = selectedProject.title !== 'Loading...' ? allProjects.find(p => p.title === selectedProject.title) : undefined;
      
      if (matchById) {
        // Hydrate title/public status. 
        // DO NOT stomp on the accountId if we already have a valid one that matches the owner.
        // We only set it if it's missing.
        const needsHydration = selectedProject.title === 'Loading...' || 
                               selectedProject.title !== matchById.title || 
                               selectedProject.public !== matchById.public;
        
        if (needsHydration || !selectedProject.accountId) {
          console.log('[Projects] Hydrating project details. Preserving accountId if present.');
          setSelectedProject({ 
            ...matchById, 
            accountId: selectedProject.accountId || browsingAccountId 
          });
        }
      } else if (matchByTitle) {
        if (selectedProject.id !== matchByTitle.id || !selectedProject.accountId) {
          console.log('[Projects] Syncing project by title. Setting accountId.');
          setSelectedProject({ ...matchByTitle, accountId: selectedProject.accountId || browsingAccountId });
        }
      }
    }
  }, [projectsData, githubToken, fetchProjectTasks, setSelectedProject, selectedProject, browsingAccountId]);

  const handleSelectRealProject = useCallback((id: string, title: string, isPublic?: boolean, forceToken?: string) => {
    setIsProjectModalOpen(false);

    let finalPublic = isPublic;
    if (finalPublic === undefined) {
      const found = projectsData.flatMap(o => o.projects).find(p => p.id === id);
      finalPublic = found ? found.public : false;
    }

    const project = { id, title, public: finalPublic, accountId: browsingAccountId };
    setSelectedProject(project);
    setHasProject(true);
    
    sessionStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.setItem('selected_project', JSON.stringify(project));
    sessionStorage.removeItem('selected_project_type');
    localStorage.removeItem('selected_project_type');

    const isMockAccount = browsingAccountId === 'mock-1';
    const isMockProject = isMockAccount;
    const tokenToUse = forceToken || (isMockProject ? MOCK_TOKEN : githubToken);

    if (tokenToUse) {
      fetchProjectTasks(id, tokenToUse);
      updateSyncTime();
    }

    const newItem: ProjectHistoryItem = { id, title, public: finalPublic, accountId: browsingAccountId, lastOpened: Date.now() };
    
    // Success: Clear any pending auth context
    localStorage.removeItem('auth_return_context');
    const nextHistory = [newItem, ...projectHistory.filter(item => item.id !== id)].slice(0, 20);
    setProjectHistory(nextHistory);
  }, [githubToken, fetchProjectTasks, updateSyncTime, projectsData, browsingAccountId, projectHistory, setProjectHistory, setIsProjectModalOpen, setSelectedProject, setHasProject]);

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

  // Sync initial state to URL if missing
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedProject?.id && !url.searchParams.has('project')) {
      url.searchParams.set('project', selectedProject.id);
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [selectedProject?.id]);

  const refreshProjects = useCallback(() => {
    fetchProjects(githubToken, browsingAccountId, false);
  }, [fetchProjects, githubToken, browsingAccountId]);

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
    refreshProjects,
    handleSelectRealProject,
    handleRemoveFromHistory,
    groupHistoryByDate,
    sortProjects,
  };
}
