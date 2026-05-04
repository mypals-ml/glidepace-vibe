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

  // Stable references to prevent orchestration loops
  const authRef = useRef(auth);
  const uiRef = useRef(ui);
  useEffect(() => { authRef.current = auth; }, [auth]);
  useEffect(() => { uiRef.current = ui; }, [ui]);

  // 2. Projects Hook (Needs bridge to Tasks and Sync)
  const projects = useDashboardProjects({
    githubToken: auth.browsingToken, // Projects list uses browsing account token
    browsingAccountId: auth.browsingAccountId,
    setIsProjectModalOpen: ui.setIsProjectModalOpen,
    updateSyncTime: useCallback(() => updateSyncTimeRef.current(), []),
    fetchProjectTasks: useCallback((id: string, token: string) => fetchProjectTasksRef.current(id, token), []),
    getTokenById: auth.getTokenById,
  });

  // 3. Compute effective tokens (Must be after projects hook)
  const projectToken = auth.getTokenById(projects.selectedProject?.accountId);

  // 4. Tasks Hook (Needs Auth, UI, and Project State)
  const tasks = useDashboardTasks({
    githubToken: projectToken,
    selectedProject: projects.selectedProject,
    projectsData: projects.projectsData,
    projectAccountId: projects.selectedProject?.accountId || '',
    githubAccounts: auth.githubAccounts,
    updateSyncTime: useCallback(() => updateSyncTimeRef.current(), []),
    setIsCreateMode: ui.setIsCreateMode,
  });

  // 5. Sync Hook (Needs Bridge to Tasks)
  const sync = useDashboardSync({
    githubToken: projectToken,
    selectedProject: projects.selectedProject,
    tasks: tasks.tasks,
    fetchProjectTasks: useCallback((id: string, token: string) => fetchProjectTasksRef.current(id, token), []),
    fetchSingleProjectItem: useCallback((id: string, token: string) => fetchSingleItemRef.current(id, token), []),
  });

  // 5. Assign Refs to capture the actual implementations
  fetchProjectTasksRef.current = tasks.fetchProjectTasks;
  fetchSingleItemRef.current = tasks.fetchSingleProjectItem;
  updateSyncTimeRef.current = sync.updateSyncTime;

  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // ---- Effects moved back to Provider for orchestration ----

  const { checkAppInstallation, browsingAccountId, getTokenById } = auth;
  const { activeTabLogin, fetchProjects, hasProject, selectedProject } = projects;
  const { fetchProjectTasks } = tasks;

  // App Installation check
  useEffect(() => {
    if (activeTabLogin) {
      checkAppInstallation(activeTabLogin);
    }
  }, [activeTabLogin, checkAppInstallation]);

  // Initial data load - Projects List
  useEffect(() => {
    const browsingToken = getTokenById(browsingAccountId);
    if (browsingToken) {
      fetchProjects(browsingToken, browsingAccountId, !hasProject);
    }
  }, [browsingAccountId, fetchProjects, hasProject, getTokenById]);

  // Initial data load - Tasks
  useEffect(() => {
    if (projectToken && selectedProject) {
      if (selectedProject.accountId) {
        fetchProjectTasks(selectedProject.id, projectToken);
      }
    }
  }, [projectToken, selectedProject, fetchProjectTasks]);

  // ---- Unified Account Addition & Project Reload Routine ----

  const processAuthReturnContext = useCallback(() => {
    const savedContextStr = localStorage.getItem('auth_return_context');
    console.log('[Auth] Processing return context. Saved context:', savedContextStr);
    if (!savedContextStr) return;

    try {
      const context = JSON.parse(savedContextStr);
      
      // Step 1: Reload active project (Restores background)
      if (context.project_id) {
        console.log('[Auth] Step 1: Restoring background project:', context.project_id);
        projectsRef.current.setSelectedProject({ 
          id: context.project_id, 
          title: 'Loading...', 
          public: false, 
          accountId: context.account_id 
        });
      }

      // Step 2: Check new account and show dialog (Retrieved from storage)
      if (context.new_account_id) {
        console.log('[Auth] Step 2: Automatically opening project modal for account:', context.new_account_id);
        authRef.current.setBrowsingAccountId(context.new_account_id);
        uiRef.current.setIsProjectModalOpen(true);
      }
      
      // Step 3: Immediate Cleanup
      console.log('[Auth] Step 3: Cleaning up return context');
      localStorage.removeItem('auth_return_context');
    } catch (e) {
      console.error('[Auth] Failed to process auth return context:', e);
      localStorage.removeItem('auth_return_context');
    }
  }, []); // Stable thanks to refs

  useEffect(() => {
    console.log('[Auth] DashboardProvider: Single Mount Effect -> Triggering processAuthReturnContext');
    processAuthReturnContext();
  }, [processAuthReturnContext]); // Re-add dependency now that it's stable

  // Memoize the callback to prevent the hook's useEffect from firing on every render
  const handleOAuthSuccess = useCallback(() => {
    console.log('[Auth] Provider: handleOAuthSuccess triggered -> Triggering processAuthReturnContext');
    processAuthReturnContext();
  }, [processAuthReturnContext]);

  // OAuth Callback Trigger
  auth.useOAuthCallback(handleOAuthSuccess);

  const handleOpenProjectClick = useCallback(() => {
    if (auth.githubAccounts.length > 0) {
      ui.setIsProjectModalOpen(true);
    } else {
      sessionStorage.setItem('pending_open_project', 'true');
      localStorage.setItem('pending_open_project', 'true');
      auth.handleOpenAuth();
    }
  }, [auth, ui]);

  const handleDisconnect = useCallback((accountId: string) => {
    auth.handleDisconnect(accountId, () => {
      // 1. Filter project history to remove items belonging to the disconnected account
      const nextHistory = projects.projectHistory.filter(p => p.accountId !== accountId);
      projects.setProjectHistory(nextHistory);
      
      // 2. Only close the current project if it belongs to the disconnected account
      if (projects.selectedProject?.accountId === accountId) {
        projects.setHasProject(false);
        projects.setSelectedProject(null);
        tasks.setTasks([]);
      }
    });
  }, [auth, projects, tasks]);

  const handleAddAccountByToken = useCallback(async (token: string) => {
    console.log('[Auth] Provider: handleAddAccountByToken started');
    // Phase 0: Context Preservation for PAT
    const context = {
      project_id: projects.selectedProject?.id,
      account_id: projects.selectedProject?.accountId,
      new_account_id: null
    };
    console.log('[Auth] Provider: Saving PAT return context:', context);
    localStorage.setItem('auth_return_context', JSON.stringify(context));

    const result = await auth.handleAddAccountByToken(token);
    console.log('[Auth] Provider: auth.handleAddAccountByToken result:', result.success ? 'SUCCESS' : 'FAILED', result.error);

    if (result.success && result.account) {
      ui.setIsAccountModalOpen(false);
      ui.setIsPatModalOpen(false);
      
      // Update storage and trigger parameterless routine
      console.log('[Auth] Provider: Calling updateAuthReturnContext for account:', result.account.id);
      auth.updateAuthReturnContext(result.account.id);
      console.log('[Auth] Provider: handleAddAccountByToken succeeded -> Triggering processAuthReturnContext');
      processAuthReturnContext();
    } else {
      localStorage.removeItem('auth_return_context');
    }
    return result;
  }, [auth, projects, ui, processAuthReturnContext]);

  const value: DashboardContextValue = {
    ...auth,
    githubToken: projectToken, // Overwrite global token with the project-specific one
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
