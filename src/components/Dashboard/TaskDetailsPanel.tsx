import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import type { Task } from '../../types';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal } from '../../lib/githubTaskMapper';
import { TaskDetailsContent } from './TaskDetailsContent';

interface TaskDetailsPanelProps {
  task: Task | null;
  onClose: () => void;
  isInline?: boolean;
}

export function TaskDetailsPanel({ task, onClose, isInline = false }: TaskDetailsPanelProps) {
  const { t } = useTranslation();
  const {
    isCreateMode,
    setIsCreateMode,
    centerGanttOnTask,
    setIsChartVisible,
    setDashboardView,
    setPendingTaskInsertPosition,
  } = useDashboard();

  if (!task && !isCreateMode) return null;

  const handleClose = () => {
    onClose();
    setPendingTaskInsertPosition(null);
    setIsCreateMode(false);
  };

  const handleCenterInGantt = () => {
    if (!task) return;
    const startDate = getStartDateForCal(task);
    if (startDate) {
      setIsChartVisible(true);
      setDashboardView('gantt');
      centerGanttOnTask(task.id, startDate);
      handleClose();
    }
  };

  const handleBackdropClick = () => {
    if (!isCreateMode) {
      handleClose();
    }
  };

  const title = isCreateMode ? t('createTask.title', 'Create New Task') : t('dashboard.taskDetails');

  const headerActions = (buttonSize: 'sm' | 'md') => (
    <div className="flex items-center gap-1">
      {!isCreateMode && task && (
        <>
          {task.url && (
            <IconButton
              icon="open_in_new"
              variant="ghost"
              size={buttonSize}
              onClick={() => window.open(task.url, '_blank')}
              title={t('dashboard.viewOnGitHub') || 'View on GitHub'}
              aria-label={t('dashboard.viewOnGitHub') || 'View on GitHub'}
            />
          )}
          <IconButton
            icon="center_focus_strong"
            variant="ghost"
            size={buttonSize}
            onClick={handleCenterInGantt}
            title={t('dashboard.centerInGantt') || 'Center in Gantt'}
            aria-label={t('dashboard.centerInGantt') || 'Center in Gantt'}
          />
        </>
      )}
      <IconButton icon="close" variant="ghost" size={buttonSize} onClick={handleClose} aria-label="Close" />
    </div>
  );

  return (
    <>
      {!isInline && (
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 ${
            isCreateMode
              ? 'bg-slate-900/5 cursor-default'
              : 'bg-slate-900/20 backdrop-blur-[1px] cursor-pointer'
          }`}
          onClick={handleBackdropClick}
        />
      )}
      <div
        className={`${
          isInline
            ? 'relative h-full w-full flex flex-col'
            : 'fixed md:absolute inset-0 md:inset-auto md:right-4 md:top-4 md:bottom-4 md:w-[26rem] md:rounded-xl md:shadow-lg'
        } z-50 flex flex-col`}
      >
        <div className="md:hidden bg-white/90 backdrop-blur-md h-full rounded-t-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {headerActions('md')}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 pt-4 space-y-6">
            <TaskDetailsContent key={isCreateMode ? 'new-task' : task?.id} task={task} t={t} isCreateMode={isCreateMode} />
          </div>
        </div>

        <div className={`hidden md:flex flex-col bg-white/95 backdrop-blur-sm ${
          isInline ? '' : 'rounded-xl shadow-lg border border-slate-200/60'
        } h-full overflow-hidden`}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200/60 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {headerActions('sm')}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 pt-4 space-y-4">
            <TaskDetailsContent key={isCreateMode ? 'new-task' : task?.id} task={task} t={t} isCreateMode={isCreateMode} />
          </div>
        </div>
      </div>
    </>
  );
}
