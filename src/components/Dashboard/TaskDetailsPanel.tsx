import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import type { Task } from '../../types';

interface TaskDetailsPanelProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailsPanel({ task, onClose }: TaskDetailsPanelProps) {
  const { t } = useTranslation();

  if (!task) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-status-done-bg text-status-done-text border border-status-done-border';
      case 'In Progress':
        return 'bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border';
      default:
        return 'bg-status-todo-bg text-status-todo-text border border-status-todo-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Done':
        return 'check_circle';
      case 'In Progress':
        return 'progress_activity';
      default:
        return 'radio_button_unchecked';
    }
  };

  return (
    <>
      {/* Mobile Fullscreen Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose}></div>

      {/* Panel Container */}
      <div className="fixed md:absolute inset-0 md:inset-auto md:right-4 md:top-4 md:bottom-4 md:w-96 md:rounded-xl md:shadow-lg z-50 flex flex-col">
        {/* Fullscreen Wrapper for Mobile */}
        <div className="md:hidden bg-white h-full rounded-t-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.taskDetails')}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined text-xl text-slate-600">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
            <TaskContent task={task} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} t={t} />
          </div>
        </div>

        {/* Floating Panel for Desktop */}
        <div className="hidden md:flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/60 h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
            <h2 className="text-sm font-bold text-slate-900">{t('dashboard.taskDetails')}</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined text-lg text-slate-600">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <TaskContent task={task} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} t={t} />
          </div>
        </div>
      </div>
    </>
  );
}

function TaskContent({ task, getStatusColor, getStatusIcon, t }: { task: Task; getStatusColor: (s: string) => string; getStatusIcon: (s: string) => string; t: any }) {
  return (
    <>
      {/* Task ID and Title */}
      <div>
        <div className="flex items-start gap-3">
          <span className="text-xs font-mono text-slate-500 mt-1 flex-shrink-0">{task.id}</span>
          <h3 className="text-base md:text-sm font-bold text-slate-900">{task.title}</h3>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">{t('table.status')}</label>
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(task.status)}`}>
          <span className="material-symbols-outlined text-sm">{getStatusIcon(task.status)}</span>
          <span className="text-sm font-medium">
            {task.status === 'Done'
              ? t('taskStatuses.done')
              : task.status === 'In Progress'
                ? t('taskStatuses.inProgress')
                : t('taskStatuses.todo')}
          </span>
        </div>
      </div>

      {/* Repository */}
      {task.repository && (
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.repository')}</label>
          <p className="text-sm text-slate-700">{task.repository}</p>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.startDate')}</label>
          <p className="text-sm text-slate-700">{task.startDate}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.endDate')}</label>
          <p className="text-sm text-slate-700">{task.endDate}</p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.progress')}</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                task.progress === 100
                  ? 'bg-status-done-highlight'
                  : task.progress > 0
                    ? 'bg-status-inprogress-highlight'
                    : 'bg-status-todo-highlight'
              }`}
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-slate-600 w-10 text-right">{task.progress}%</span>
        </div>
      </div>

      {/* Task Description */}
      {task.body && (
        <div className="border-t border-slate-200/60 pt-4">
          <label className="text-xs font-medium text-slate-600 block mb-2">Description</label>
          <p className="text-sm text-slate-700 leading-relaxed">{task.body}</p>
        </div>
      )}

      {/* Assignees */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="border-t border-slate-200/60 pt-4">
          <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.assignees')}</label>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map(user => (
              <div
                key={user.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${user.avatarColor}`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold">{user.initials}</span>
                )}
                <span className="text-sm font-medium">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      {task.comments && task.comments.length > 0 && (
        <div className="border-t border-slate-200/60 pt-4">
          <label className="text-xs font-medium text-slate-600 block mb-3">
            Comments ({task.comments.length})
          </label>
          <div className="space-y-3">
            {task.comments.map((comment, idx) => (
              <div key={comment.id} className="bg-slate-50/50 rounded-lg p-3 border border-slate-200/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${comment.author.avatarColor}`}>
                    {comment.author.avatarUrl ? (
                      <img
                        src={comment.author.avatarUrl}
                        alt={comment.author.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      comment.author.initials
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-700">{comment.author.name}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(comment.createdAt).toLocaleDateString(undefined, { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{comment.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
