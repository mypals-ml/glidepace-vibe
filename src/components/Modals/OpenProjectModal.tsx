import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDashboard } from '../../context/DashboardContext';
import type { SortMethod } from '../../types';

export function OpenProjectModal() {
  const { t } = useTranslation();
  const {
    githubAccounts,
    setActiveAccountId,
    isRefreshing,
    isAppInstalled,
    projectsData,
    activeTabLogin,
    setActiveTabLogin,
    apiError,
    sortMethod,
    setSortMethod,
    sortProjects,
    fetchProjects,
    handleSelectRealProject,
    isProjectModalOpen,
    setIsProjectModalOpen,
    setIsAccountModalOpen,
    isChartVisible,
    setIsChartVisible,
  } = useDashboard();

  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isProjectModalOpen) {
      setSelectedAccountId(null);
      setIsChartVisible(false);
    }
  }, [isProjectModalOpen, setIsChartVisible]);

  useClickOutside(sortDropdownRef, () => setIsSortDropdownOpen(false), isSortDropdownOpen);

  if (!isProjectModalOpen) return null;

  const sortLabelKey: Record<SortMethod, string> = {
    recent: 'dashboard.sortRecent',
    oldest: 'dashboard.sortOldest',
    nameAZ: 'dashboard.sortNameAZ',
    nameZA: 'dashboard.sortNameZA',
  };

  const appInstallUrl = (() => {
    let url = import.meta.env.VITE_GITHUB_APP_INSTALL_URL || '#';
    if (url !== '#' && url.includes('github.com/apps/') && !url.includes('/installations/new')) {
      url = url.replace(/\/$/, '') + '/installations/new';
    }
    return url;
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="open-project-title">
      <div className="bg-white/90 backdrop-blur-xl w-full max-w-5xl h-full lg:h-auto rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border border-white/40">
        {/* Header */}
        <div className="px-6 lg:px-8 py-4 lg:py-6 flex justify-between items-center bg-slate-50/40 border-b border-slate-200">
          <div>
            <h2 id="open-project-title" className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">{t('dashboard.openProjectModalTitle')}</h2>
            <p className="text-xs lg:text-sm text-slate-500 font-medium mt-1">{t('dashboard.openProjectModalDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChartVisible(!isChartVisible)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
              aria-label={isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isChartVisible ? 'format_list_bulleted' : 'show_chart'}
              </span>
              <span>{isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}</span>
            </button>
            <button onClick={() => setIsProjectModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 ml-2" aria-label="Close">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </div>
        {/* Modal Content */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:min-h-[550px] overflow-hidden bg-slate-50/50">
          {/* Left Column: Connected Accounts */}
          <div
            className={`flex-shrink-0 border-slate-200 lg:border-r w-full lg:w-[32%] ${isChartVisible ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}
          >
            <div className="p-6 lg:p-8 flex flex-col h-full min-h-0">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-8 shrink-0">{t('app.connectedAccountsLabel')}</h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                {githubAccounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    setActiveAccountId(account.id);
                    fetchProjects(account.token, account.id, false);
                    setIsChartVisible(true);
                  }}
                  className={`relative flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${selectedAccountId === account.id ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-200' : 'hover:bg-slate-100/60'}`}
                >
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-200">
                    <img alt={account.login} className="w-full h-full object-cover" src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <p className={`text-sm font-bold truncate transition-colors ${selectedAccountId === account.id ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>@{account.login}</p>
                    <p className="text-[11px] font-bold tracking-tight mt-0.5 text-slate-400">{t('app.connected')}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAccountId(account.id);
                      fetchProjects(account.token, account.id, false);
                    }}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${
                      isRefreshing[account.id] 
                        ? 'opacity-100' 
                        : (selectedAccountId === account.id ? 'opacity-0 group-hover:opacity-100' : 'hidden')
                    } transition-opacity p-2 hover:bg-slate-200 rounded-full flex items-center justify-center bg-white/80 backdrop-blur shadow-sm`}
                    title={t('dashboard.refreshProjects')}
                    aria-label={t('dashboard.refreshProjects')}
                  >
                    <span className={`material-symbols-outlined text-slate-500 text-[18px] ${isRefreshing[account.id] ? 'animate-spin' : ''}`}>refresh</span>
                  </button>
                </div>
              ))}
            </div>
              {/* Manage Button */}
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="w-full mt-8 flex items-center justify-center gap-3 p-4 bg-slate-100/50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-xl transition-all group shrink-0"
              >
                <span className="material-symbols-outlined text-slate-500 group-hover:text-slate-800 transition-colors" aria-hidden="true">settings</span>
                <span className="text-sm font-bold text-slate-500 group-hover:text-slate-800 transition-colors">{t('dashboard.manageButton')}</span>
              </button>
            </div>
          </div>
          {/* Right Column: Projects */}
          <div
            className={`flex-1 bg-white/50 w-full lg:w-auto ${!isChartVisible ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}
          >
            <div className="p-6 lg:p-8 flex flex-col h-full min-h-0">
              <button
                onClick={() => setIsChartVisible(false)}
                className="lg:hidden flex items-center gap-2 text-slate-500 font-bold text-sm mb-6 hover:text-slate-700 transition-colors self-start shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                {t('app.connectedAccountsLabel')}
              </button>
              {!selectedAccountId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-300">
                <span className="material-symbols-outlined text-5xl mb-4 opacity-50">account_circle</span>
                <p className="font-medium text-slate-600">Select an account from the left list to view projects.</p>
              </div>
            ) : (
              <>

            {/* Auto Sync Banner */}
            {(() => {
              const activeOwner = projectsData.find(o => o.login === activeTabLogin);
              let targetUrl = appInstallUrl;
              if (activeOwner?.databaseId && targetUrl !== '#') {
                const connector = targetUrl.includes('?') ? '&' : '?';
                targetUrl += `${connector}target_id=${activeOwner.databaseId}&suggested_target_id=${activeOwner.databaseId}`;
              }

              return projectsData.length > 0 && !isAppInstalled[activeTabLogin] && (
                <div className="mb-6 bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100/50 rounded-lg">
                      <span className="material-symbols-outlined text-indigo-600 text-[20px]">sync</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900">Enable Automatic Sync</h4>
                      <p className="text-xs text-indigo-700/80 mt-0.5 max-w-sm leading-relaxed">
                        Get real-time task updates. Install our official GitHub App to safely enable background webhooks for these projects.
                      </p>
                    </div>
                  </div>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all ml-4"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Install App
                  </a>
                </div>
              );
            })()}

            {/* Tabs for user/orgs */}
            {projectsData.length > 0 && (
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
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors group font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">help</span>
                    <span className="group-hover:underline">{t('dashboard.orgProjectsHelpLink')}</span>
                  </a>
                </div>
              </div>
            )}

            {apiError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <strong>GitHub API Error:</strong> {apiError}
                <p className="mt-2 text-xs opacity-80">This usually means the GitHub App is missing some permissions (like Projects or Members) or hasn't been updated. Check your browser console for more details.</p>
              </div>
            )}

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">search</span>
                <input className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-slate-100 focus:border-slate-300 placeholder:text-slate-400 transition-all shadow-sm" placeholder={t('dashboard.searchProjectsPlaceholder')} type="text" aria-label={t('dashboard.searchProjectsPlaceholder')} />
              </div>
              <div className="relative" ref={sortDropdownRef}>
                <div
                  onClick={() => setIsSortDropdownOpen(prev => !prev)}
                  className="flex items-center justify-between sm:justify-start gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm select-none"
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
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
              {(() => {
                const activeOwner = projectsData.find(o => o.login === activeTabLogin);
                const list = sortProjects(activeOwner?.projects || []);

                let targetUrl = appInstallUrl;
                if (activeOwner?.databaseId && targetUrl !== '#') {
                  const connector = targetUrl.includes('?') ? '&' : '?';
                  targetUrl += `${connector}target_id=${activeOwner.databaseId}&suggested_target_id=${activeOwner.databaseId}`;
                }

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
                    <div className="py-12 px-6 text-center text-slate-500 flex flex-col items-center">
                      <span className="material-symbols-outlined text-4xl mb-4 text-slate-300" aria-hidden="true">inbox</span>
                      <p className="mb-2 font-bold text-slate-700">{t('dashboard.noProjectsFound')}</p>
                      <p className="text-xs opacity-90 max-w-md mb-6 leading-relaxed">
                        {t('dashboard.noProjectsFoundHint')}
                      </p>
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 px-4 rounded-lg shadow-sm transition-colors border border-slate-200 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                        {t('dashboard.manageAppInstall')}
                      </a>
                    </div>
                  );
                }
              })()}
            </div>
            </>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
