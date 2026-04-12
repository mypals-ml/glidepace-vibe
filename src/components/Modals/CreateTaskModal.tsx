import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { useClickOutside } from '../../hooks/useClickOutside';

export function CreateTaskModal() {
  const { t } = useTranslation();
  const {
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    selectedProject,
    handleCreateTask,
  } = useDashboard();

  const [taskTitle, setTaskTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(modalRef, () => !isCreating && setIsCreateTaskModalOpen(false), isCreateTaskModalOpen);

  useEffect(() => {
    if (isCreateTaskModalOpen) {
      setTaskTitle('');
      setError(null);
      setIsCreating(false);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isCreateTaskModalOpen]);

  if (!isCreateTaskModalOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!taskTitle.trim()) {
      setError(t('createTask.titleRequired') || 'Task title is required');
      return;
    }

    if (!selectedProject) {
      setError(t('createTask.projectRequired') || 'No project selected');
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const success = await handleCreateTask(taskTitle.trim());
      if (success) {
        setIsCreateTaskModalOpen(false);
        setTaskTitle('');
      } else {
        setError(t('createTask.creationFailed') || 'Failed to create task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (t('createTask.creationError') || 'An error occurred'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setTaskTitle('');
    setError(null);
    setIsCreateTaskModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="create-task-modal-title">
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg overflow-hidden flex flex-col animate-in zoom-in slide-in-from-bottom-4 duration-300"
      >
        {/* Header - Matching TaskDetailsPanel */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
          <h2 id="create-task-modal-title" className="text-sm font-bold text-slate-900">
            {t('createTask.title') || 'Create New Task'}
          </h2>
          <button
            onClick={handleCancel}
            disabled={isCreating}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label={t('createTask.cancel') || 'Cancel'}
          >
            <span className="material-symbols-outlined text-lg text-slate-600">close</span>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                {t('createTask.titlePlaceholder') || 'Task title'}
              </label>
              <div className="relative group">
                <input
                  ref={inputRef}
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={t('createTask.titlePlaceholder') || 'Task title'}
                  disabled={isCreating}
                  maxLength={255}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-sm transition-all outline-none 
                    ${error ? 'border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400' : 'border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary'}
                    placeholder:text-slate-400 disabled:opacity-50`}
                />
                {error && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-0.5 animate-in slide-in-from-top-1">
                    <span className="material-symbols-outlined text-red-500 text-xs">error</span>
                    <span className="text-[11px] font-medium text-red-500">{error}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {t('createTask.description') || 'Add a new task to your project'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {t('createTask.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isCreating || !taskTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <>
                    <span>{t('createTask.create') || 'Create'}</span>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
