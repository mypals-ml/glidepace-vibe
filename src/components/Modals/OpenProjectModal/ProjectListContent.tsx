import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { AutoSyncBanner } from './AutoSyncBanner';
import type { SortMethod } from '../../../types';

interface ProjectListContentProps {
  selectedAccountId: string | null;
  appInstallUrl: string;
  isSortDropdownOpen: boolean;
  setIsSortDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  sortDropdownRef: React.RefObject<HTMLDivElement | null>;
}

export function ProjectListContent({
  selectedAccountId,
  appInstallUrl,
  isSortDropdownOpen,
  setIsSortDropdownOpen,
  sortDropdownRef
}: ProjectListContentProps) {
  const { t } = useTranslation();
  const {
    projectsData,
    activeTabLogin,
    setActiveTabLogin,
    apiError,
    sortMethod,
    setSortMethod,
    sortProjects,
    handleSelectRealProject
  } = useDashboard();

  if (!selectedAccountId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-300">
        <span className="material-symbols-outlined text-5xl mb-4 opacity-50">account_circle</span>
        <p className="font-medium text-slate-600">{t('dashboard.selectAccountToViewProjects')}</p>
      </div>
    );
  }

  const sortLabelKey: Record<SortMethod, string> = {
    recent: 'dashboard.sortRecent',
    oldest: 'dashboard.sortOldest',
    nameAZ: 'dashboard.sortNameAZ',
    nameZA: 'dashboard.sortNameZA',
  };

  const activeOwner = projectsData.find(o => o.login === activeTabLogin);
  const list = sortProjects(activeOwner?.projects || []);

  const getTargetUrlForOwner = (owner: any) => {
    let url = appInstallUrl;
    if (owner?.databaseId && url !== '#') {
      const connector = url.includes('?') ? '&' : '?';
      return `${url}${connector}target_id=${owner.databaseId}&suggested_target_id=${owner.databaseId}`;
    }
    return url;
  };

  const hasAnyOrg = projectsData.some(owner => owner.isOrg);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AutoSyncBanner appInstallUrl={appInstallUrl} />

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
          {!hasAnyOrg && (
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
          )}
        </div>
      )}


      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>{t('dashboard.githubApiErrorTitle')}</strong> {apiError}
          <p className="mt-2 text-xs opacity-80">{t('dashboard.githubApiErrorDesc')}</p>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">search</span>
          <input 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-slate-100 focus:border-slate-300 placeholder:text-slate-400 transition-all shadow-sm" 
            placeholder={t('dashboard.searchProjectsPlaceholder')} 
            type="text" 
            aria-label={t('dashboard.searchProjectsPlaceholder')} 
          />
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
        {list.length > 0 ? (
          list.map(proj => (
            <div 
              key={proj.id} 
              onClick={() => handleSelectRealProject(proj.id, proj.title)}
              className="group flex items-center justify-between p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
            >
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
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRealProject(proj.id, proj.title);
                      }} 
                      className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-sm shadow-primary/20"
                    >
                      {t('dashboard.openProjectAction')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 px-6 text-center text-slate-500 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-4 text-slate-300" aria-hidden="true">inbox</span>
            <p className="mb-2 font-bold text-slate-700">{t('dashboard.noProjectsFound')}</p>
            <p className="text-xs opacity-90 max-w-md mb-6 leading-relaxed">
              {t('dashboard.noProjectsFoundHint')}
            </p>
            <a
              href={getTargetUrlForOwner(activeOwner)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 px-4 rounded-lg shadow-sm transition-colors border border-slate-200 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
              {t('dashboard.manageAppInstall')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
