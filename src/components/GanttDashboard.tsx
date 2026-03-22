import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DUMMY_TASKS } from '../lib/dummyData';
import { useTranslation } from 'react-i18next';
import { GITHUB_GRAPHQL_API_URL, GITHUB_OAUTH_AUTHORIZE_URL } from '../lib/constants';
import { USE_MOCK_DATA, MOCK_ACCOUNTS, MOCK_PROJECTS } from '../lib/mockData';

type SortMethod = 'recent' | 'oldest' | 'nameAZ' | 'nameZA';

interface GitHubProject {
  id: string;
  title: string;
}

interface ProjectOwnerInfo {
  login: string;
  isOrg: boolean;
  projects: GitHubProject[];
}

interface ProjectHistoryItem {
  id: string;
  title: string;
  lastOpened: number;
}

interface GithubAccount {
  id: string;
  login: string;
  name?: string;
  avatarUrl: string;
  token: string;
}

export function GanttDashboard() {
  const { t, i18n } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [hasProject, setHasProject] = useState(() => {
    return !!localStorage.getItem('selected_project_type') || !!localStorage.getItem('selected_project');
  });
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>(() => {
    if (USE_MOCK_DATA) return MOCK_ACCOUNTS;
    try {
      return JSON.parse(localStorage.getItem('github_accounts') || '[]');
    } catch {
      return [];
    }
  });
  const [activeAccountId, setActiveAccountId] = useState<string>(() => USE_MOCK_DATA ? MOCK_ACCOUNTS[0].id : (localStorage.getItem('active_github_account_id') || ''));
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});
  const [sortMethod, setSortMethod] = useState<SortMethod>('recent');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('project_history') || '[]');
    } catch {
      return [];
    }
  });

  const saveHistory = (history: ProjectHistoryItem[]) => {
    setProjectHistory(history);
    localStorage.setItem('project_history', JSON.stringify(history));
  };

  const githubToken = githubAccounts.find(a => a.id === activeAccountId)?.token || '';
  const [projectsData, setProjectsData] = useState<ProjectOwnerInfo[]>(USE_MOCK_DATA ? MOCK_PROJECTS : []);
  const [activeTabLogin, setActiveTabLogin] = useState<string>(USE_MOCK_DATA ? MOCK_ACCOUNTS[0].login : '');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{id: string, title: string} | null>(() => {
    try {
      const saved = localStorage.getItem('selected_project');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [tasks, setTasks] = useState<any[]>(DUMMY_TASKS);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => {
    const saved = localStorage.getItem('last_synced_time');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isHoveringSync, setIsHoveringSync] = useState(false);
  const [, setTick] = useState(0); // Force re-render for relative time
  const isResizing = useRef(false);

  const updateSyncTime = () => {
    const now = Date.now();
    setLastSyncedTime(now);
    localStorage.setItem('last_synced_time', now.toString());
  };

  const getSyncedTimeText = (time: number) => {
    if (!time) return '';
    const diff = Date.now() - time;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 5) return t('app.syncedJustNow');
    if (minutes < 60) return t('app.syncedMinutesAgo', { count: minutes });
    if (hours < 24) return t('app.syncedHoursAgo', { count: hours });
    if (days < 30) return t('app.syncedDaysAgo', { count: days });
    if (months < 12) return t('app.syncedMonthsAgo', { count: months });
    return t('app.syncedYearsAgo', { count: years });
  };

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchProjectTasks = async (projectId: string, token: string) => {
    setIsLoadingTasks(true);
    try {
      const res = await fetch(GITHUB_GRAPHQL_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `
            query($projectId: ID!) {
              node(id: $projectId) {
                ... on ProjectV2 {
                  items(first: 50) {
                    nodes {
                      id
                      content {
                        ... on DraftIssue { title body }
                        ... on Issue {
                          title
                          number
                          state
                          assignees(first: 5) {
                            nodes { login name avatarUrl }
                          }
                        }
                        ... on PullRequest {
                          title
                          number
                          state
                          assignees(first: 5) {
                            nodes { login name avatarUrl }
                          }
                        }
                      }
                      fieldValues(first: 20) {
                        nodes {
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2SingleSelectField { name } }
                          }
                          ... on ProjectV2ItemFieldDateValue {
                            date
                            field { ... on ProjectV2Field { name } }
                          }
                          ... on ProjectV2ItemFieldTextValue {
                            text
                            field { ... on ProjectV2Field { name } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { projectId }
        })
      });
      const json = await res.json();
      const items = json.data?.node?.items?.nodes || [];
      
      const mappedTasks = items.map((item: any) => {
        const content = item.content;
        const fieldValues = item.fieldValues.nodes;
        
        // Extract status from fieldValues
        const statusField = fieldValues.find((f: any) => f.field?.name === 'Status');
        const status = statusField?.name || 'Todo';
        
        // Extract dates (Start Date, End Date) if they exist
        const startDateField = fieldValues.find((f: any) => f.field?.name?.toLowerCase().includes('start'));
        const endDateField = fieldValues.find((f: any) => f.field?.name?.toLowerCase().includes('end'));
        
        const startDate = startDateField?.date || new Date().toISOString().split('T')[0];
        const endDate = endDateField?.date || startDate;

        // Map assignees
        const assignees = (content?.assignees?.nodes || []).map((a: any, idx: number) => ({
          id: a.login,
          name: a.name || a.login,
          avatarUrl: a.avatarUrl,
          initials: (a.name || a.login).substring(0, 2).toUpperCase(),
          avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4]
        }));

        return {
          id: content?.number ? `#${content.number}` : item.id.substring(0, 5),
          title: content?.title || 'No Title',
          startDate: new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          endDate: new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          fullStartDate: startDate,
          fullEndDate: endDate,
          status: status === 'Done' ? 'Done' : (status === 'In Progress' ? 'In Progress' : 'Todo'),
          assignees: assignees.length > 0 ? assignees : [{ id: 'unassigned', name: 'Unassigned', initials: '??', avatarColor: 'bg-slate-100 text-slate-400' }],
          progress: status === 'Done' ? 100 : (status === 'In Progress' ? 50 : 0)
        };
      });
      
      setTasks(mappedTasks);
      updateSyncTime();
    } catch (e) {
      console.error('Failed to fetch project tasks:', e);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code && !githubToken) {
        setIsLoadingAuth(true);
        try {
          // Send code to the local mock or vercel serverless function
          const res = await fetch(`/api/github-oauth-callback?code=${code}`, {
            headers: { 'Accept': 'application/json' }
          });
          const data = await res.json();
          if (data.access_token && data.user) {
            const newAccount = {
              id: data.user.id,
              login: data.user.login,
              name: data.user.name,
              avatarUrl: data.user.avatar_url,
              token: data.access_token
            };
            setGithubAccounts(prev => {
              const filtered = prev.filter(acc => acc.id !== newAccount.id);
              const nextAccounts = [...filtered, newAccount];
              localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
              return nextAccounts;
            });
            setActiveAccountId(newAccount.id);
            localStorage.setItem('active_github_account_id', newAccount.id);
            // setIsAccountModalOpen(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            if (localStorage.getItem('pending_open_project') === 'true') {
              localStorage.removeItem('pending_open_project');
              setIsProjectModalOpen(true);
            }
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
  }, [githubToken]);

  const fetchProjects = async (token: string, accountId: string, forceModal: boolean = false) => {
    setIsRefreshing(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(GITHUB_GRAPHQL_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `
            query {
              viewer {
                login
                projectsV2(first: 20) {
                  nodes { id title }
                }
                organizations(first: 10) {
                  nodes {
                    login
                    projectsV2(first: 20) {
                      nodes { id title }
                    }
                  }
                }
              }
            }
          `
        })
      });
      const json = await res.json();
      const viewer = json.data?.viewer;
      if (viewer) {
        const owners: ProjectOwnerInfo[] = [];
        owners.push({
          login: viewer.login,
          isOrg: false,
          projects: viewer.projectsV2?.nodes || []
        });
        
        const orgs = viewer.organizations?.nodes || [];
        for (const org of orgs) {
          owners.push({
            login: org.login,
            isOrg: true,
            projects: org.projectsV2?.nodes || []
          });
        }
        
        setProjectsData(owners);
        setActiveTabLogin(viewer.login);
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
  };

  useEffect(() => {
    if (githubToken && !hasProject) {
      fetchProjects(githubToken, activeAccountId, true);
    }
    
    // If we have a selected project on mount, fetch its tasks
    const projectType = localStorage.getItem('selected_project_type');
    if (githubToken && selectedProject && !projectType) {
      fetchProjectTasks(selectedProject.id, githubToken);
    } else if (projectType === 'dummy') {
      setTasks(DUMMY_TASKS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubToken]);
  
  // Real-time sync listener
  useEffect(() => {
    if (!selectedProject?.id) return;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials missing, auto-sync disabled.');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const channel = supabase.channel(`project-${selectedProject.id}`);
    
    channel
      .on('broadcast', { event: 'sync' }, (payload) => {
        console.log('Real-time sync triggered via Supabase:', payload);
        if (githubToken && selectedProject.id) {
          fetchProjectTasks(selectedProject.id, githubToken);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to Supabase Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject?.id, githubToken]);

  const handleOpenAuth = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      alert("Missing VITE_GITHUB_CLIENT_ID environment variable!");
      return;
    }
    window.location.href = `${GITHUB_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=read:org,project`;
  };

  const handleOpenProjectClick = () => {
    if (githubAccounts.length > 0) {
      setIsProjectModalOpen(true);
    } else {
      localStorage.setItem('pending_open_project', 'true');
      handleOpenAuth();
    }
  };

  const handleDisconnect = (accountId: string) => {
    const nextAccounts = githubAccounts.filter(a => a.id !== accountId);
    setGithubAccounts(nextAccounts);
    localStorage.setItem('github_accounts', JSON.stringify(nextAccounts));
    if (activeAccountId === accountId) {
      const nextActive = nextAccounts.length > 0 ? nextAccounts[0].id : '';
      setActiveAccountId(nextActive);
      localStorage.setItem('active_github_account_id', nextActive);
    }
    if (nextAccounts.length === 0) {
      setIsAccountModalOpen(false);
      setHasProject(false);
    }
  };

  const handleSelectRealProject = (id: string, title: string) => {
    setIsProjectModalOpen(false);
    const project = { id, title };
    setSelectedProject(project);
    setHasProject(true);
    localStorage.setItem('selected_project', JSON.stringify(project));
    localStorage.removeItem('selected_project_type');
    
    if (githubToken) {
      fetchProjectTasks(id, githubToken);
      updateSyncTime();
    }

    // Update history
    const newItem: ProjectHistoryItem = { id, title, lastOpened: Date.now() };
    const filtered = projectHistory.filter(item => item.id !== id);
    const nextHistory = [newItem, ...filtered].slice(0, 20); // Keep last 20
    saveHistory(nextHistory);
  };

  const handleRemoveFromHistory = (id: string) => {
    const nextHistory = projectHistory.filter(item => item.id !== id);
    saveHistory(nextHistory);
  };

  const groupHistoryByDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - 7 * 86400000;

    const groups: Record<string, ProjectHistoryItem[]> = {
      today: [],
      yesterday: [],
      last7Days: [],
      earlier: []
    };

    projectHistory.forEach(item => {
      if (item.lastOpened >= today) groups.today.push(item);
      else if (item.lastOpened >= yesterday) groups.yesterday.push(item);
      else if (item.lastOpened >= last7Days) groups.last7Days.push(item);
      else groups.earlier.push(item);
    });

    return groups;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.userSelect = '';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX - 16;
    if (newWidth >= 250 && newWidth <= 800) {
      setSidebarWidth(newWidth);
    }
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Close sort dropdown on click outside
  const handleClickOutsideSort = useCallback((e: MouseEvent) => {
    if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
      setIsSortDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideSort);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideSort);
  }, [isSortDropdownOpen, handleClickOutsideSort]);

  // Close project dropdown on click outside
  const handleClickOutsideProject = useCallback((e: MouseEvent) => {
    if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
      setIsProjectDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isProjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideProject);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideProject);
  }, [isProjectDropdownOpen, handleClickOutsideProject]);

  const sortLabelKey: Record<SortMethod, string> = {
    recent: 'dashboard.sortRecent',
    oldest: 'dashboard.sortOldest',
    nameAZ: 'dashboard.sortNameAZ',
    nameZA: 'dashboard.sortNameZA',
  };

  const sortProjects = (projects: GitHubProject[]): GitHubProject[] => {
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
  };

  return (
    <div className="bg-background-main text-slate-800 font-sans h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="glass-panel border-b border-surface-border px-6 py-3 flex items-center justify-between z-20 sticky top-0 bg-white/70 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900"><a href="https://github.com/mypals-ml/glidepace-vibe" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{t('app.name')}</a></h1>
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-3">
            <div className="relative" ref={projectDropdownRef}>
              <div 
                onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors h-9 overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary"
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isProjectDropdownOpen}
              >
                <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('app.projectLabel')}</div>
                <div className="px-3 py-1.5 text-sm font-bold text-slate-700 flex items-center gap-2">
                  {hasProject 
                    ? (selectedProject ? selectedProject.title : t('app.dummyProjectOption')) 
                    : t('app.emptyProjectOption')}
                  <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
                </div>
              </div>

              {isProjectDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 glass-panel rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 border border-slate-200/60" role="listbox">
                  <div className="p-2 space-y-1">
                    {/* Hide empty/dummy when a real project is selected */}
                    {!(hasProject && selectedProject) && (
                      <>
                        <button 
                          onClick={() => { 
                            setHasProject(true); 
                            setSelectedProject(null); 
                            setIsProjectDropdownOpen(false); 
                            localStorage.removeItem('selected_project');
                            localStorage.setItem('selected_project_type', 'none');
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${!selectedProject && localStorage.getItem('selected_project_type') === 'none' ? 'bg-primary/10 text-primary font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                          role="option"
                          aria-selected={!selectedProject && localStorage.getItem('selected_project_type') === 'none'}
                        >
                          {t('app.emptyProjectOption')}
                          {!selectedProject && localStorage.getItem('selected_project_type') === 'none' && <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>}
                        </button>
                        <button 
                          onClick={() => { 
                            setHasProject(true); 
                            setSelectedProject(null); 
                            setIsProjectDropdownOpen(false); 
                            setTasks(DUMMY_TASKS);
                            localStorage.removeItem('selected_project');
                            localStorage.setItem('selected_project_type', 'dummy');
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${!selectedProject && localStorage.getItem('selected_project_type') === 'dummy' ? 'bg-primary/10 text-primary font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                          role="option"
                          aria-selected={!selectedProject && localStorage.getItem('selected_project_type') === 'dummy'}
                        >
                          {t('app.dummyProjectOption')}
                          {!selectedProject && localStorage.getItem('selected_project_type') === 'dummy' && <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>}
                        </button>
                      </>
                    )}

                    {/* Project History */}
                    {(() => {
                      const groups = groupHistoryByDate();
                      const groupOrder = [
                        { key: 'today', label: t('dashboard.historyToday') },
                        { key: 'yesterday', label: t('dashboard.historyYesterday') },
                        { key: 'last7Days', label: t('dashboard.historyLast7Days') },
                        { key: 'earlier', label: t('dashboard.historyEarlier') }
                      ];

                      return groupOrder.map(group => {
                        const items = groups[group.key];
                        if (items.length === 0) return null;

                        return (
                          <div key={group.key} className="space-y-1">
                            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 first:border-0 mt-1 first:mt-0 pt-3 first:pt-1">
                              {group.label}
                            </div>
                            {items.map(item => (
                              <div key={item.id} className="relative group">
                                <button 
                                  onClick={() => { handleSelectRealProject(item.id, item.title); setIsProjectDropdownOpen(false); }}
                                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center ${selectedProject?.id === item.id ? 'bg-primary/10 text-primary font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                                  role="option"
                                  aria-selected={selectedProject?.id === item.id}
                                >
                                  <span className="truncate pr-10">{item.title}</span>
                                  {selectedProject?.id === item.id && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center group-hover:opacity-0 transition-opacity pointer-events-none" aria-hidden="true">
                                      <span className="material-symbols-outlined text-[20px]">check</span>
                                    </div>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveFromHistory(item.id); }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-rose-50 z-10"
                                  title={t('dashboard.removeFromHistory')}
                                >
                                  <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button 
                      onClick={() => { handleOpenProjectClick(); setIsProjectDropdownOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/20"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">folder_open</span>
                      {t('dashboard.addProjectButton')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
              <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500" id="language-select-label">{t('app.language')}</div>
              <select 
                className="border-0 focus:ring-0 text-sm py-1.5 pl-3 pr-8 w-28 text-slate-700 font-medium focus:outline-none bg-transparent appearance-none cursor-pointer"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                aria-labelledby="language-select-label"
              >
                <option value="en">{t('app.locales.en')}</option>
                <option value="ja">{t('app.locales.ja')}</option>
                <option value="zh-CN">{t('app.locales.zhCN')}</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]" aria-hidden="true">language</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {githubToken && (
            <div 
              className="hidden lg:flex items-center"
              onMouseEnter={() => setIsHoveringSync(true)}
              onMouseLeave={() => setIsHoveringSync(false)}
            >
              {(() => {
                const isStale = lastSyncedTime && (Date.now() - lastSyncedTime) > 60000;
                
                if (isHoveringSync) {
                  return (
                    <button 
                      onClick={() => {
                        if (selectedProject?.id) {
                          fetchProjectTasks(selectedProject.id, githubToken);
                        } else {
                          fetchProjects(githubToken, activeAccountId);
                        }
                      }}
                      className="flex items-center gap-2 px-3 h-8 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold shadow-sm transition-all animate-in fade-in zoom-in duration-200"
                    >
                      <span className="material-symbols-outlined text-[16px] animate-spin-slow">sync</span>
                      <span className="leading-none">{t('app.syncNow')}</span>
                    </button>
                  );
                }
                
                return (
                  <div 
                    className={`flex items-center gap-2 px-3 h-8 rounded-full border text-xs font-medium shadow-sm transition-all animate-in fade-in duration-300 ${
                      isStale 
                        ? 'bg-slate-50 border-slate-200 text-slate-500' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`} 
                    aria-live="polite"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStale ? 'bg-slate-300' : 'bg-emerald-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isStale ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                    </span>
                    <span className="leading-none">{getSyncedTimeText(lastSyncedTime)}</span>
                  </div>
                );
              })()}
            </div>
          )}
          
          <button 
            onClick={githubAccounts.length > 0 ? () => setIsAccountModalOpen(true) : handleOpenAuth}
            disabled={isLoadingAuth}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${githubAccounts.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'} ${isLoadingAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
          >
            {isLoadingAuth ? (
               <svg aria-hidden="true" className="w-4 h-4 fill-current animate-spin" viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"></path></svg>
            ) : (
               <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path></svg>
            )}
            {githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-10 w-full p-4 gap-4">
        {hasProject ? (
          <>
        
        {/* Sidebar: Issues List */}
        <aside style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 glass-panel rounded-xl flex flex-col z-10 h-full overflow-hidden hidden md:flex bg-white/80 shadow-sm border border-slate-200/60" aria-label={t('dashboard.issuesList')}>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse" aria-label={t('dashboard.issuesList')}>
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-12">{t('table.id')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">{t('table.title')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-24">{t('table.status')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-20 text-center">{t('table.assignees')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingTasks ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('dashboard.loadingTasks')}</span>
                      </div>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                      {t('dashboard.noTasksInProject')}
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id} className={`h-[50px] hover:bg-slate-50/80 transition-colors cursor-pointer group bg-white relative`} tabIndex={0} aria-label={`${task.title} - ${t('table.status')} ${task.status}`}>
                      <td className="px-4 py-0 text-xs text-slate-400 font-mono align-middle relative">
                        {task.status === 'In Progress' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-inprogress-highlight" aria-hidden="true"></div>}
                        {task.status === 'Done' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-done-highlight" aria-hidden="true"></div>}
                        {task.status === 'Todo' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-todo-highlight" aria-hidden="true"></div>}
                        {task.id}
                      </td>
                      <td className="px-4 py-0 align-middle">
                        <span className={`text-sm font-medium transition-colors block leading-tight ${task.status === 'Done' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-700 group-hover:text-primary'}`}>{task.title}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{task.startDate} - {task.endDate}</div>
                      </td>
                      <td className="px-4 py-0 align-middle">
                        {task.status === 'Done' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-done-bg text-status-done-text border border-status-done-border">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-done-highlight mr-1.5"></span>{t('taskStatuses.done')}
                          </span>
                        )}
                        {task.status === 'In Progress' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border">
                             <span className="w-1.5 h-1.5 rounded-full bg-status-inprogress-highlight mr-1.5 animate-pulse"></span>{t('taskStatuses.inProgress')}
                          </span>
                        )}
                        {task.status === 'Todo' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-todo-bg text-status-todo-text border border-status-todo-border">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-todo-highlight mr-1.5"></span>{t('taskStatuses.todo')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top pt-3">
                        <div className="flex justify-center -space-x-1.5">
                          {task.assignees.slice(0, 3).map((user: any, idx: number) => (
                             <div key={user.id} className={`w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold ${user.avatarColor}`} style={{ zIndex: 10 - idx }} title={user.name}>
                               {user.avatarUrl ? (
                                 <img src={user.avatarUrl} alt={user.initials} className="w-full h-full rounded-full object-cover" />
                               ) : user.initials}
                             </div>
                          ))}
                          {task.assignees.length > 3 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold bg-slate-100 text-slate-500" style={{ zIndex: 0 }}>
                              +{task.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Bottom Search Box */}
          <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md mt-auto">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">search</span>
              <input className="w-full bg-white border border-slate-200 shadow-sm rounded-md pl-9 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder={t('dashboard.filterPlaceholder')} aria-label={t('dashboard.filterPlaceholder')} type="text" />
            </div>
          </div>
        </aside>

        {/* Resizer Handle */}
        <div
          className="w-2 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-1 flex items-center justify-center group"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
        </div>

        {/* Timeline Region */}
        <main className="flex-1 flex flex-col overflow-hidden relative z-10 glass-panel rounded-xl bg-white/80 shadow-sm border border-slate-200/60" aria-label="Timeline View" role="region">
           <div className="h-12 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex sticky top-0 z-20" aria-hidden="true">
              <div className="flex-1 flex text-[11px] font-semibold text-slate-500 select-none uppercase tracking-wider">
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.mon')}</span></div>
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.tue')}</span></div>
                <div className="flex-1 border-r border-slate-200 flex flex-col justify-center items-center bg-indigo-50/50 text-indigo-600 relative">
                  <div className="absolute top-0 w-full h-0.5 bg-indigo-500"></div>
                  <span>{t('days.wed')}</span>
                  <span className="h-1 w-1 rounded-full bg-indigo-500 mt-0.5"></span>
                </div>
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.thu')}</span></div>
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.fri')}</span></div>
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50/50 text-slate-400"><span>{t('days.sat')}</span></div>
                <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50/50 text-slate-400"><span>{t('days.sun')}</span></div>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto relative custom-scrollbar bg-white/40">
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1 border-r border-slate-100"></div>
                <div className="flex-1 border-r border-slate-100"></div>
                <div className="flex-1 border-r border-indigo-100 bg-indigo-50/20"></div>
                <div className="flex-1 border-r border-slate-100"></div>
                <div className="flex-1 border-r border-slate-100"></div>
                <div className="flex-1 border-r border-slate-100 bg-slate-50/30"></div>
                <div className="flex-1 border-r border-slate-100 bg-slate-50/30"></div>
              </div>
              <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, transparent 49px, rgba(226, 232, 240, 0.4) 50px)', backgroundSize: '100% 50px' }}></div>
              
              <div className="relative w-full h-full pt-[5px] pb-10">
                {isLoadingTasks ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-30">
                     <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
                        <span className="text-sm font-bold text-slate-500">{t('dashboard.loadingTasks')}</span>
                     </div>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm italic">
                    {t('dashboard.noTasksInProject')}
                  </div>
                ) : (
                  <>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minHeight: '400px' }}>
                      <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
                        </marker>
                      </defs>
                      {/* Basic static arrows - could be made dynamic if dependencies are implemented */}
                      <path d="M 28% 25 C 32% 25, 32% 75, 36% 75" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)"></path>
                      <path d="M 64% 75 C 68% 75, 68% 125, 72% 125" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)"></path>
                    </svg>

                    {tasks.map((task, idx) => {
                      // Simple positioning logic for demo purposes
                      // In a real app, this would be based on actual dates
                      const leftPos = (idx * 15 + 5) % 80;
                      const width = 20 + (idx * 10) % 40;
                      
                      return (
                        <div key={task.id} className="relative h-[50px] w-full flex items-center group z-10 px-2">
                          <div 
                            className={`absolute h-8 rounded-md border flex items-center px-3 cursor-pointer transition-all shadow-sm ${
                              task.status === 'Done' 
                                ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50' 
                                : task.status === 'In Progress'
                                  ? 'bg-primary border-primary-hover shadow-glow hover:bg-primary-hover'
                                  : 'bg-white border-slate-300 hover:bg-slate-50'
                            }`}
                            style={{ 
                              left: `${leftPos}%`, 
                              width: `${width}%` 
                            }}
                          >
                            {task.status === 'In Progress' && <div className="w-1 h-5 bg-white/40 rounded-full mr-2"></div>}
                            <span className={`text-xs font-medium truncate ${
                              task.status === 'Done' ? 'text-emerald-700 opacity-70 line-through' : task.status === 'In Progress' ? 'text-white font-bold' : 'text-slate-600'
                            }`}>
                              {task.id} {task.title}
                            </span>
                            {task.status === 'Done' && (
                              <div className="ml-auto flex items-center">
                                <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                              </div>
                            )}
                            {task.status === 'In Progress' && (
                              <div className="ml-auto flex items-center gap-2">
                                <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden hidden sm:block">
                                  <div className="h-full bg-white opacity-80" style={{ width: `${task.progress}%` }}></div>
                                </div>
                                <span className="text-[9px] font-bold text-white/90">{task.progress}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
           </div>
        </main>
          </>
        ) : (
          <div className="flex-1 flex overflow-hidden glass-panel bg-white/80 shadow-sm border border-slate-200/60 rounded-xl">
             <div className="w-1/3 min-w-[350px] bg-white border-r border-slate-200/60 flex flex-col items-center justify-center p-8">
                <div className="w-16 h-16 rounded-full border border-dashed border-slate-300 flex items-center justify-center mb-4 text-slate-400" aria-hidden="true">
                  <span className="material-symbols-outlined text-3xl">folder_off</span>
                </div>
                <h2 className="text-lg font-semibold mb-1 text-slate-800">{t('dashboard.emptyStateTitle')}</h2>
                <p className="text-sm text-slate-500 mb-6 text-center">{t('dashboard.emptyStateDesc')}</p>
                <button
                  onClick={handleOpenProjectClick}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                  aria-label={t('dashboard.addProjectButton')}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">folder_open</span>
                  {t('dashboard.addProjectButton')}
                </button>
             </div>
             
             <div className="flex-1 flex flex-col bg-slate-50/50">
               <div className="h-12 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex shadow-sm z-10" aria-hidden="true">
                  <div className="flex-1 flex text-[11px] font-semibold text-slate-500 select-none uppercase tracking-wider">
                    <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.mon')}</span></div>
                    <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.tue')}</span></div>
                    <div className="flex-1 border-r border-slate-200 flex flex-col justify-center items-center bg-indigo-50/50 text-indigo-600 relative">
                      <div className="absolute top-0 w-full h-0.5 bg-indigo-500"></div>
                      <span>{t('days.wed')}</span>
                    </div>
                    <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.thu')}</span></div>
                    <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.fri')}</span></div>
                    <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50 text-slate-400"><span>{t('days.sat')}</span></div>
                    <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 text-slate-400"><span>{t('days.sun')}</span></div>
                  </div>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center p-8">
                   <span className="material-symbols-outlined text-6xl text-slate-300 mb-4" aria-hidden="true">calendar_month</span>
                   <p className="text-slate-500 font-medium">{t('dashboard.addProjectTimelinePrompt')}</p>
               </div>
             </div>
          </div>
        )}
      </div>
      {/* Real OAuth Project Selector Modal overlay */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="open-project-title">
          <div className="bg-white/90 backdrop-blur-xl w-full max-w-5xl rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border border-white/40">
            {/* Header */}
            <div className="px-8 py-6 flex justify-between items-center bg-slate-50/40 border-b border-slate-200">
              <div>
                <h2 id="open-project-title" className="text-2xl font-extrabold tracking-tight text-slate-900">{t('dashboard.openProjectModalTitle')}</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">{t('dashboard.openProjectModalDesc')}</p>
              </div>
              <button onClick={() => setIsProjectModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" aria-label="Close">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex flex-1 min-h-[550px]">
              {/* Left Column: Connected Accounts */}
              <div className="w-[32%] bg-slate-50/50 p-8 border-r border-slate-200 flex flex-col">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-8">{t('app.connectedAccountsLabel')}</h3>
                <div className="space-y-4 flex-1">
                  {githubAccounts.map((account) => (
                    <div 
                      key={account.id} 
                      onClick={() => { setActiveAccountId(account.id); localStorage.setItem('active_github_account_id', account.id); }}
                      className={`relative flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${activeAccountId === account.id ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-200' : 'hover:bg-slate-100/60'}`}
                    >
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-200">
                        <img alt={account.login} className={`w-full h-full object-cover ${activeAccountId !== account.id ? 'grayscale opacity-50' : ''}`} src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <p className={`text-sm font-bold truncate transition-colors ${activeAccountId === account.id ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900'}`}>@{account.login}</p>
                        <p className="text-[11px] font-bold tracking-tight mt-0.5 text-slate-400">{t('app.connected')}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveAccountId(account.id);
                          localStorage.setItem('active_github_account_id', account.id);
                          fetchProjects(account.token, account.id, false);
                        }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 ${isRefreshing[account.id] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity p-2 hover:bg-slate-200 rounded-full flex items-center justify-center bg-white/80 backdrop-blur shadow-sm`}
                        title={t('dashboard.refreshProjects')}
                        aria-label={t('dashboard.refreshProjects')}
                      >
                        <span className={`material-symbols-outlined text-slate-500 text-[18px] ${isRefreshing[account.id] ? 'animate-spin' : ''}`}>refresh</span>
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add Account Button -> maps to Manage */}
                <button 
                  onClick={() => setIsAccountModalOpen(true)}
                  className="w-full mt-8 flex items-center justify-center gap-3 p-4 bg-slate-100/50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-xl transition-all group"
                >
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-slate-800 transition-colors" aria-hidden="true">settings</span>
                  <span className="text-sm font-bold text-slate-500 group-hover:text-slate-800 transition-colors">{t('dashboard.manageButton')}</span>
                </button>
              </div>
              {/* Right Column: Projects */}
              <div className="w-[68%] p-8 bg-white/50 flex flex-col">
                {/* Tabs for user/orgs or help link only */}
                {projectsData.length > 0 && (
                  projectsData.some(o => o.isOrg) ? (
                    <div className="flex items-end justify-between mb-6 border-b border-slate-200">
                      <div className="flex flex-wrap gap-2">
                        {projectsData.map(owner => (
                          <button
                            key={owner.login}
                            onClick={() => setActiveTabLogin(owner.login)}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                              activeTabLogin === owner.login 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {owner.login}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 pb-2 px-2">
                        <a 
                          href="/help/org-projects" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 transition-colors group font-semibold"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 'var(--text-base)' }}>help</span>
                          <span className="group-hover:underline">{t('dashboard.orgProjectsHelpLink')}</span>
                        </a>
                        <a 
                          href={import.meta.env.VITE_GITHUB_APP_INSTALL_URL || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm font-bold border border-teal-500 hover:shadow-md"
                          title="Install GitHub App to enable automatic sync for more repositories"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          Install App
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end items-center gap-4 mb-6">
                      <a 
                        href="/help/org-projects" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 transition-colors group font-semibold"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 'var(--text-base)' }}>help</span>
                        <span className="group-hover:underline">{t('dashboard.orgProjectsHelpLink')}</span>
                      </a>
                      <a 
                        href={import.meta.env.VITE_GITHUB_APP_INSTALL_URL || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm font-bold border border-teal-500 hover:shadow-md"
                        title="Install GitHub App to enable automatic sync for more repositories"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        Install App
                      </a>
                    </div>
                  )
                )}
                {/* Filters & Search */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">search</span>
                    <input className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-slate-100 focus:border-slate-300 placeholder:text-slate-400 transition-all shadow-sm" placeholder={t('dashboard.searchProjectsPlaceholder')} type="text" aria-label={t('dashboard.searchProjectsPlaceholder')} />
                  </div>
                  <div className="relative" ref={sortDropdownRef}>
                    <div
                      onClick={() => setIsSortDropdownOpen(prev => !prev)}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm select-none"
                      role="button"
                      aria-haspopup="listbox"
                      aria-expanded={isSortDropdownOpen}
                    >
                      <span className="opacity-70">{t('dashboard.sortBy')}</span>
                      <span className="text-slate-900">{t(sortLabelKey[sortMethod])}</span>
                      <span className={`material-symbols-outlined text-sm transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
                    </div>
                    {isSortDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150" role="listbox">
                        {(['recent', 'oldest', 'nameAZ', 'nameZA'] as SortMethod[]).map((method) => (
                          <button
                            key={method}
                            onClick={() => { setSortMethod(method); setIsSortDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between ${
                              sortMethod === method
                                ? 'bg-primary/5 text-primary font-bold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                            role="option"
                            aria-selected={sortMethod === method}
                          >
                            {t(sortLabelKey[method])}
                            {sortMethod === method && (
                              <span className="material-symbols-outlined text-primary text-sm" aria-hidden="true">check</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {(() => {
                    const activeOwner = projectsData.find(o => o.login === activeTabLogin);
                    const list = sortProjects(activeOwner?.projects || []);
                    
                    if (list.length > 0) {
                      return list.map(proj => (
                        <div key={proj.id} className="group flex items-center justify-between p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-500">account_tree</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">{proj.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.projectIdPrefix')}{proj.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center transition-all">
                              <div className="hidden group-hover:flex items-center gap-3 transition-all">
                                <button onClick={() => handleSelectRealProject(proj.id, proj.title)} className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-sm shadow-primary/20">
                                  {t('dashboard.openProjectAction')}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    } else {
                      return (
                        <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                          <span className="material-symbols-outlined text-4xl mb-4 text-slate-300" aria-hidden="true">inbox</span>
                          <p>{t('dashboard.noProjectsFound')}</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Connected Accounts Management Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="manage-accounts-title">
          <div className="relative bg-white/70 backdrop-blur-xl border border-white w-full max-w-md rounded-xl shadow-[0_12px_40px_rgba(25,28,30,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-8 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 id="manage-accounts-title" className="font-sans text-2xl font-extrabold text-slate-900">{t('app.connectedAccounts')}</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors" aria-label="Close">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              <p className="text-slate-500 text-sm">{t('app.manageAccounts')}</p>
            </div>
            {/* Modal Content (Account List) */}
            <div className="p-8 space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
              {githubAccounts.map((account) => (
                <div key={account.id} onClick={() => { setActiveAccountId(account.id); localStorage.setItem('active_github_account_id', account.id); }} className={`flex items-center justify-between bg-white/50 p-4 rounded-xl border transition-all cursor-pointer ${activeAccountId === account.id ? 'border-primary ring-1 ring-primary' : 'border-white/40 hover:border-primary/50'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-primary/20">
                      <img className="w-full h-full object-cover" alt={account.login} src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
                    </div>
                    <div>
                      <p className="font-sans font-bold text-slate-900 leading-tight flex items-center gap-2">
                        {account.name || account.login}
                        {activeAccountId === account.id && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">{t('app.activeStatus')}</span>}
                      </p>
                      <p className="text-xs text-slate-500">@{account.login}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDisconnect(account.id); }} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-all">
                    {t('app.disconnect')}
                  </button>
                </div>
              ))}
            </div>
            {/* Modal Footer (Action) */}
            <div className="p-8 pt-2">
              <button onClick={handleOpenAuth} className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-sans font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">add_circle</span>
                {t('app.connectToAdd')}
              </button>
              <p className="text-center mt-4 text-xs text-slate-500 px-6">
                {t('app.addAccountPermissionNotice')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
