import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';
import { OverflowItem } from '@fluentui/react-overflow';

/**
 * Sync status indicator button.
 * Does NOT wrap itself in OverflowItem — that is done by the parent Header.
 */
export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const {
    githubToken,
    lastSyncedTime,
    getSyncedTimeText,
    selectedProject,
    fetchProjectTasks,
    refreshProjects,
  } = useDashboard();

  const handleSync = () => {
    if (selectedProject?.id) {
      fetchProjectTasks(selectedProject.id, githubToken);
    } else {
      refreshProjects();
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleSync}
      className="px-2 lg:px-4 justify-center relative transition-all duration-300 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
      aria-label={t('app.syncNow')}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">sync</span>
        <OverflowItem id="sync-text" priority={30}>
          <span className="text-xs font-medium whitespace-nowrap">
            {getSyncedTimeText(lastSyncedTime)}
          </span>
        </OverflowItem>
      </div>
    </Button>
  );
}
