import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { DUMMY_TASKS } from '../lib/dummyData';
import { DashboardContext } from './DashboardContext';
import type { DashboardContextValue } from './DashboardContext';

// Hooks
import { useDashboardAuth } from '../hooks/useDashboardAuth';
import { useDashboardUI } from '../hooks/useDashboardUI';
import { useDashboardProjects } from '../hooks/useDashboardProjects';
import { useDashboardTasks } from '../hooks/useDashboardTasks';
import { useDashboardSync } from '../hooks/useDashboardSync';

// Service
import { DUMMY_PROJECT_ID } from '../lib/githubMock';

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Bridging Refs to break circular dependencies between hooks
  const fetchProjectTasksRef = useRef<(id: string, token: string) => Promise<void>>(() => Promise.resolve());
  const fetchSingleItemRef = useRef<(id: string, token: string) => Promise<void>>(() => Promise.resolve());
  const updateSyncTimeRef = useRef<() => void>(() => {});

  // 1. UI & Auth (independent)
  const auth = useDashboardAuth();
  const ui = useDashboardUI();

  // 2. Projects Hook (Needs bridge to Tasks and Sync)
  const projects = useDashboardProjects({
    githubToken: auth.githubToken,
    activeAccountId: auth.activeAccountId,
    setIsProjectModalOpen: ui.setIsProjectModalOpen,
    updateSyncTime: () => updateSyncTimeRef.current(),
    fetchProjectTasks: (id, token) => fetchProjectTasksRef.current(id, token),
  });

  // 3. Tasks Hook (Needs Auth, UI, and Project State)
  const tasks = useDashboardTasks({
    githubToken: auth.githubToken,
    selectedProject: projects.selectedProject,
    projectsData: projects.projectsData,
    activeAccountId: auth.activeAccountId,
    githubAccounts: auth.githubAccounts,
    updateSyncTime: () => updateSyncTimeRef.current(),
    setIsCreateMode: ui.setIsCreateMode,
  });

  // 4. Sync Hook (Needs Bridge to Tasks)
  const sync = useDashboardSync({
    githubToken: auth.githubToken,
    selectedProject: projects.selectedProject,
    tasks: tasks.tasks,
    fetchProjectTasks: (id, token) => fetchProjectTasksRef.current(id, token),
    fetchSingleProjectItem: (id, token) => fetchSingleItemRef.current(id, token),
  });

  // 5. Assign Refs to capture the actual implementations
  fetchProjectTasksRef.current = tasks.fetchProjectTasks;
  fetchSingleItemRef.current = tasks.fetchSingleProjectItem;
  updateSyncTimeRef.current = sync.updateSyncTime;

  // ---- Effects moved back to Provider for orchestration ----

  // App Installation check
  useEffect(() => {
    const { checkAppInstallation } = auth;
    if (projects.activeTabLogin) {
      checkAppInstallation(projects.activeTabLogin);
    }
  }, [projects.activeTabLogin, auth]);

  // Initial data load
  useEffect(() => {
    if (auth.githubToken && !projects.hasProject) {
      projects.fetchProjects(auth.githubToken, auth.activeAccountId, true);
    }

    if (auth.githubToken && projects.selectedProject) {
      tasks.fetchProjectTasks(projects.selectedProject.id, auth.githubToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.githubToken]);

  // ---- Demo helpers ----

  const handleOpenProjectClick = useCallback(() => {
    if (auth.githubAccounts.length > 0) {
      ui.setIsProjectModalOpen(true);
    } else {
      localStorage.setItem('pending_open_project', 'true');
      auth.handleOpenAuth();
    }
  }, [auth, ui]);

  const handleOpenDummyProject = useCallback(() => {
    const mockAccount = auth.githubAccounts.find(a => a.id === 'mock-1');
    if (!mockAccount) {
      // Logic from old provider - simplified
      auth.setActiveAccountId('mock-1');
    } else {
      auth.setActiveAccountId(mockAccount.id);
    }
    projects.handleSelectRealProject(DUMMY_PROJECT_ID, 'Demo: Product Roadmap 2024', true);
  }, [auth, projects]);

  const handleDisconnect = useCallback((accountId: string) => {
    auth.handleDisconnect(accountId, () => {
      projects.setProjectHistory([]);
      projects.setHasProject(false);
      projects.setSelectedProject(null);
      tasks.setTasks(DUMMY_TASKS);
    });
  }, [auth, projects, tasks]);

  const handleAddAccountByToken = useCallback(async (token: string) => {
    return auth.handleAddAccountByToken(
      token,
      () => projects.fetchProjects(auth.githubToken, auth.activeAccountId, true),
      () => {
        ui.setIsAccountModalOpen(false);
        ui.setIsPatModalOpen(false);
      }
    );
  }, [auth, projects, ui]);

  const value: DashboardContextValue = {
    ...auth,
    ...ui,
    ...projects,
    ...tasks,
    ...sync,
    handleDisconnect,
    handleOpenProjectClick,
    handleOpenDummyProject,
    handleAddAccountByToken,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
