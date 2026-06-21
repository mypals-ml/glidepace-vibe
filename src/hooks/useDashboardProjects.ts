import { useState, useCallback, useEffect } from 'react';
import { USE_MOCK_DATA, MOCK_PROJECTS } from '../lib/mockData';
import { fetchGitHubGraphQL, isGitHubRateLimitError } from '../lib/githubService';
import { githubReadCache, READ_CACHE_TTL } from '../lib/githubReadCache';
import { GET_USER_PROJECTS_QUERY } from '../lib/githubQueries';
import type { ProjectOwnerInfo, GitHubProject, ProjectHistoryItem, SortMethod } from '../types';

type SelectedProject = { id: string; title: string; public: boolean; accountId?: string };

interface UseDashboardProjectsProps {
  githubToken: string;
  browsingAccountId: string;
  setIsProjectModalOpen: (open: boolean) => void;
  updateSyncTime: () => void;
}

function readSavedSelectedProject(): SelectedProject | null {
  const saved = sessionStorage.getItem('selected_project') || localStorage.getItem('selected_project');
  return saved ? JSON.parse(saved) : null;
}

function clearSavedProject(projectId?: string) {
  sessionStorage.removeItem('selected_project');
  localStorage.removeItem('selected_project');
  sessionStorage.removeItem('selected_project_type');
  localStorage.removeItem('selected_project_type');

  if (projectId) {
    localStorage.removeItem(`selected_task_${projectId}`);
  }
}

function pruneProjectHistory(projectId?: string) {
  try {
    const saved = localStorage.getItem('project_history');
    if (!saved) return [];

    const history = JSON.parse(saved) as ProjectHistoryItem[];
    const nextHistory = history.filter(item => item.accountId && (!projectId || item.id !== projectId));
    localStorage.setItem('project_history', JSON.stringify(nextHistory));
    return nextHistory;
  } catch {
    localStorage.removeItem('project_history');
    return [];
  }
}

function clearUrlProjectState() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('project') || url.searchParams.has('account')) {
    url.searchParams.delete('project');
    url.searchParams.delete('account');
    window.history.replaceState({}, document.title, url.toString());
  }
}

export function useDashboardProjects({
  githubToken,
  browsingAccountId,
  setIsProjectModalOpen,
  updateSyncTime,
}: UseDashboardProjectsProps) {

  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>('');
  const [selectedProject, setSelectedProjectState] = useState<SelectedProject | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlProjectId = urlParams.get('project');
      const urlAccountId = urlParams.get('account');
      if (urlProjectId) {
        const parsed = readSavedSelectedProject();
        const savedAccountId = parsed?.id === urlProjectId ? parsed.accountId : undefined;
        const accountId = urlAccountId || savedAccountId;
        if (!accountId) {
          clearSavedProject(urlProjectId);
          pruneProjectHistory(urlProjectId);
          clearUrlProjectState();
          return null;
        }
        return { id: urlProjectId, title: 'Loading...', public: false, accountId };
      }
      const parsed = readSavedSelectedProject();
      if (!parsed) return null;
      if (!parsed.accountId) {
        clearSavedProject(parsed.id);
        pruneProjectHistory(parsed.id);
        return null;
      }
      if (USE_MOCK_DATA && parsed?.accountId && parsed.accountId !== 'mock-1') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const setSelectedProject = useCallback((project: SelectedProject | null) => {
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
      url.searchParams.delete('account');
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
      const nextHistory = history.filter((item: ProjectHistoryItem) => item.accountId);
      if (nextHistory.length !== history.length) {
        localStorage.setItem('project_history', JSON.stringify(nextHistory));
      }
      return nextHistory;
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
      // Short-TTL cache + in-flight dedupe keyed by account: opening/switching
      // projects within the TTL reuses the list instead of re-querying GitHub.
      const cacheKey = `userProjects:${accountId}`;
      const json = await githubReadCache.get(cacheKey, READ_CACHE_TTL.userProjects, () =>
        fetchGitHubGraphQL(GET_USER_PROJECTS_QUERY, {}, token, { dedupeKey: cacheKey })
      );

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
          projects: (viewer.projectsV2?.nodes || [])
            .filter(Boolean)
            .map((p: GitHubProject) => ({ ...p, accountId })),
        });

        const orgs = viewer.organizations?.nodes || [];
        for (const org of orgs) {
          if (!org || !org.login) continue;
          owners.push({
            login: org.login,
            isOrg: true,
            databaseId: org.databaseId,
            projects: (org.projectsV2?.nodes || [])
              .filter(Boolean)
              .map((p: GitHubProject) => ({ ...p, accountId })),
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
      const error = e as Error;
      if (isGitHubRateLimitError(e)) {
        setApiError('GitHub rate limit reached. Please wait a moment and refresh.');
      } else if (error.message.includes('401')) {
        setApiError('GitHub rejected this saved credential. Disconnect and reconnect this account, or add a fresh token.');
      } else {
        setApiError(error.message || 'Failed to fetch GitHub projects.');
      }
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
        
        const accountIdChanged = matchById.accountId && selectedProject.accountId !== matchById.accountId;
        
        if (needsHydration || accountIdChanged) {
          console.log('[Projects] Hydrating project details from list.');
          setSelectedProject({ 
            ...matchById, 
            accountId: matchById.accountId
          });
        }
      } else if (matchByTitle) {
        if (selectedProject.id !== matchByTitle.id || (matchByTitle.accountId && selectedProject.accountId !== matchByTitle.accountId)) {
          console.log('[Projects] Syncing project by title. Setting accountId from list.');
          setSelectedProject({ ...matchByTitle, accountId: matchByTitle.accountId });
        }
      }
    }
  }, [projectsData, githubToken, setSelectedProject, selectedProject, browsingAccountId]);

  const handleSelectRealProject = useCallback((id: string, title: string, isPublic: boolean, accountId: string) => {
    setIsProjectModalOpen(false);

    const project = { id, title, public: isPublic, accountId };
    setSelectedProject(project);
    setHasProject(true);
    
    sessionStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.setItem('selected_project', JSON.stringify(project));
    sessionStorage.removeItem('selected_project_type');
    localStorage.removeItem('selected_project_type');

    updateSyncTime();

    const newItem: ProjectHistoryItem = { id, title, public: isPublic, accountId: accountId, lastOpened: Date.now() };
    
    // Success: Clear any pending auth context
    localStorage.removeItem('auth_return_context');
    const nextHistory = [newItem, ...projectHistory.filter(item => item.id !== id)].slice(0, 20);
    setProjectHistory(nextHistory);
  }, [updateSyncTime, projectHistory, setProjectHistory, setIsProjectModalOpen, setSelectedProject, setHasProject]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    const nextHistory = projectHistory.filter(item => item.id !== id);
    setProjectHistory(nextHistory);
  }, [projectHistory, setProjectHistory]);

  useEffect(() => {
    if (!selectedProject || selectedProject.accountId) return;

    clearSavedProject(selectedProject.id);
    setProjectHistory(pruneProjectHistory(selectedProject.id));
    setSelectedProjectState(null);
    setHasProjectState(false);
    clearUrlProjectState();
  }, [selectedProject, setProjectHistory]);

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

  // Keep URL shareable across the multi-account project state.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedProject && !selectedProject.accountId) {
      return;
    }

    if (selectedProject?.id) {
      let shouldReplace = false;

      if (url.searchParams.get('project') !== selectedProject.id) {
        url.searchParams.set('project', selectedProject.id);
        shouldReplace = true;
      }

      if (selectedProject.accountId && url.searchParams.get('account') !== selectedProject.accountId) {
        url.searchParams.set('account', selectedProject.accountId);
        shouldReplace = true;
      } else if (!selectedProject.accountId && url.searchParams.has('account')) {
        url.searchParams.delete('account');
        shouldReplace = true;
      }

      if (shouldReplace) {
        window.history.replaceState({}, document.title, url.toString());
      }
    } else if (url.searchParams.has('project') || url.searchParams.has('account')) {
      url.searchParams.delete('project');
      url.searchParams.delete('account');
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [selectedProject]);

  const refreshProjects = useCallback(() => {
    // Explicit user refresh always hits the network.
    githubReadCache.invalidate(`userProjects:${browsingAccountId}`);
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
