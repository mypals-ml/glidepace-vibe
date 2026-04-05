import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const {
    githubToken,
    lastSyncedTime,
    getSyncedTimeText,
    selectedProject,
    fetchProjectTasks,
    fetchProjects,
    activeAccountId,
  } = useDashboard();
  const [isHoveringSync, setIsHoveringSync] = useState(false);

  if (!githubToken) return null;

  const isStale = lastSyncedTime && (Date.now() - lastSyncedTime) > 60000;

  return (
    <div
      className="flex items-center shrink-0"
      onMouseEnter={() => setIsHoveringSync(true)}
      onMouseLeave={() => setIsHoveringSync(false)}
    >
      {isHoveringSync ? (
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
          <span className="material-symbols-outlined text-[16px] animate-spin-slow shrink-0">sync</span>
          <span className="leading-none hidden md:inline">{t('app.syncNow')}</span>
        </button>
      ) : (
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
          <span className="leading-none hidden md:inline">{getSyncedTimeText(lastSyncedTime)}</span>
        </div>
      )}
    </div>
  );
}
