import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { DashboardContext } from './DashboardContext';
import type { DashboardContextValue } from './DashboardContext';

// Hooks
import { useDashboardAuth } from '../hooks/useDashboardAuth';
import { useDashboardUI } from '../hooks/useDashboardUI';
import { useDashboardProjects } from '../hooks/useDashboardProjects';
import { useDashboardTasks } from '../hooks/useDashboardTasks';
import { useDashboardSync } from '../hooks/useDashboardSync';

// Service

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Bridging Refs to break circular dependencies between hooks
  const fetchProjectTasksRef = useRef<(id: string, token: string) => Promise<void>>(() => Promise.resolve());
  const fetchSingleItemRef = useRef<(id: string, token: string) => Promise<void>>(() => Promise.resolve());
  const updateSyncTimeRef = useRef<() => void>(() => {});

  // 1. UI & Auth (independent)
  const auth = useDashboardAuth();
  const ui = useDashboardUI();

  // 1.5 Sync Auth Callback (must be near top)
  auth.useOAuthCallback((token, id) => {
    // Phase 2: Atomic Transition for OAuth
    ui.setIsProjectModalOpen(true);
    auth.setActiveAccountId(id);
    projects.fetchProjects(token, id, false); // forceModal is false because we set it above
  });

  // 2. Projects Hook (Needs bridge to Tasks and Sync)
  const projects = useDashboardProjects({
    githubToken: auth.getTokenById(auth.activeAccountId), // Projects list uses active (browsing) account
    activeAccountId: auth.activeAccountId,
    githubAccounts: auth.githubAccounts,
    setIsProjectModalOpen: ui.setIsProjectModalOpen,
    updateSyncTime: () => updateSyncTimeRef.current(),
    fetchProjectTasks: (id, token) => fetchProjectTasksRef.current(id, token),
  });

  // 3. Compute effective tokens (Must be after projects hook)
  const projectToken = auth.getTokenById(projects.selectedProject?.accountId || auth.activeAccountId);

  // 4. Tasks Hook (Needs Auth, UI, and Project State)
  const tasks = useDashboardTasks({
    githubToken: projectToken,
    selectedProject: projects.selectedProject,
    projectsData: projects.projectsData,
    activeAccountId: projects.selectedProject?.accountId || auth.activeAccountId,
    githubAccounts: auth.githubAccounts,
    updateSyncTime: () => updateSyncTimeRef.current(),
    setIsCreateMode: ui.setIsCreateMode,
  });

  // 5. Sync Hook (Needs Bridge to Tasks)
  const sync = useDashboardSync({
    githubToken: projectToken,
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

  // Initial data load - Projects List
  useEffect(() => {
    const activeToken = auth.getTokenById(auth.activeAccountId);
    if (activeToken) {
      projects.fetchProjects(activeToken, auth.activeAccountId, !projects.hasProject);
    }
  }, [auth.activeAccountId]); // Only re-fetch projects when the active (browsing) account changes

  // Initial data load - Tasks
  useEffect(() => {
    if (projectToken && projects.selectedProject) {
      // ONLY fetch if the project belongs to an account we have a token for
      if (projects.selectedProject.accountId) {
        tasks.fetchProjectTasks(projects.selectedProject.id, projectToken);
      }
    }
  }, [projectToken, projects.selectedProject?.id]); // Re-fetch only if the project or its owner's token changes

  // ---- Demo helpers ----

  const handleOpenProjectClick = useCallback(() => {
    if (auth.githubAccounts.length > 0) {
      ui.setIsProjectModalOpen(true);
    } else {
      sessionStorage.setItem('pending_open_project', 'true');
      localStorage.setItem('pending_open_project', 'true');
      auth.handleOpenAuth();
    }
  }, [auth, ui]);

  // Auto-Sync Context when modal closes
  useEffect(() => {
    if (!ui.isProjectModalOpen) {
      const savedContextStr = localStorage.getItem('auth_return_context');
      if (savedContextStr) {
        try {
          const context = JSON.parse(savedContextStr);
          // If we are back on a different account than the preserved context, sync back
          if (context.account_id && auth.activeAccountId !== context.account_id) {
            auth.setActiveAccountId(context.account_id);
          }
        } catch (e) {
          console.error('Failed to parse auth_return_context', e);
        } finally {
          localStorage.removeItem('auth_return_context');
        }
      } else if (projects.selectedProject?.accountId) {
        // Fallback: Ensure active account matches open project
        if (auth.activeAccountId !== projects.selectedProject.accountId) {
          auth.setActiveAccountId(projects.selectedProject.accountId);
        }
      }
    }
  }, [ui.isProjectModalOpen, projects.selectedProject?.accountId, auth.activeAccountId]);

  const handleDisconnect = useCallback((accountId: string) => {
    auth.handleDisconnect(accountId, () => {
      projects.setProjectHistory([]);
      projects.setHasProject(false);
      projects.setSelectedProject(null);
      tasks.setTasks([]);
    });
  }, [auth, projects, tasks]);

  const handleAddAccountByToken = useCallback(async (token: string) => {
    // Phase 0: Context Preservation for PAT
    const context = {
      project_id: projects.selectedProject?.id,
      account_id: auth.activeAccountId
    };
    localStorage.setItem('auth_return_context', JSON.stringify(context));

    const result = await auth.handleAddAccountByToken(token, 
      (newToken, newId) => {
        // This is the fetch callback inside handleAddAccountByToken (if still used)
        projects.fetchProjects(newToken, newId, false);
      },
      () => {} // onCloseModals is handled below
    );

    if (result.success && result.account) {
      // Phase 2: Atomic Transition for PAT
      ui.setIsAccountModalOpen(false);
      ui.setIsPatModalOpen(false);
      ui.setIsProjectModalOpen(true);
      auth.setActiveAccountId(result.account.id);
      projects.fetchProjects(result.account.token, result.account.id, false);
    } else {
      // Cleanup context if failed
      localStorage.removeItem('auth_return_context');
    }
    return result;
  }, [auth, projects, ui]);

  const value: DashboardContextValue = {
    ...auth,
    ...ui,
    ...projects,
    ...tasks,
    ...sync,
    handleDisconnect,
    handleOpenProjectClick,
    handleAddAccountByToken,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
