import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';

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
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const checkStaleness = () => {
      if (lastSyncedTime) {
        setIsStale((Date.now() - lastSyncedTime) > 60000);
      }
    };
    
    checkStaleness();
    const interval = setInterval(checkStaleness, 10000);
    return () => clearInterval(interval);
  }, [lastSyncedTime]);

  const handleSync = () => {
    if (selectedProject?.id) {
      fetchProjectTasks(selectedProject.id, githubToken);
    } else {
      fetchProjects(githubToken, activeAccountId);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleSync}
      className={`w-[var(--btn-h-sm)] lg:w-auto lg:min-w-[140px] px-0 lg:px-4 justify-center relative transition-all duration-300 ${
        isStale 
          ? 'bg-slate-50 border-slate-200 text-slate-500' 
          : 'bg-emerald-50/50 border-emerald-100 text-emerald-700 hover:bg-emerald-50'
      }`}
      aria-label={t('app.syncNow')}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px] lg:text-[18px]">sync</span>
          {/* Status Dot Overlay */}
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStale ? 'bg-slate-300' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isStale ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
          </span>
        </div>
        <span className="hidden lg:inline text-xs font-medium whitespace-nowrap">
          {getSyncedTimeText(lastSyncedTime)}
        </span>
      </div>
    </Button>
  );
}
