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
    isLoadingTasks,
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="create-task-modal-title">
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500"
      >
        {/* Subtle top organic shape blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/10 blur-[60px] pointer-events-none rounded-full"></div>
        
        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 mb-6">
            <span className="material-symbols-outlined text-white text-3xl">add_task</span>
          </div>

          <h3 id="create-task-modal-title" className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            {t('createTask.title') || 'Create New Task'}
          </h3>
          <p className="text-sm font-medium text-slate-500 max-w-[280px] leading-relaxed mb-8">
            {t('createTask.description') || 'Add a new task to your project'}
          </p>

          <form onSubmit={handleCreate} className="w-full space-y-6">
            <div className="relative group">
              <input
                ref={inputRef}
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={t('createTask.titlePlaceholder') || 'Task title'}
                disabled={isCreating}
                maxLength={255}
                className={`w-full px-5 py-4 bg-slate-100/50 border-2 rounded-xl text-sm font-bold transition-all outline-none 
                  ${error ? 'border-rose-200 focus:border-rose-400 text-rose-900' : 'border-transparent focus:border-emerald-400 focus:bg-white text-slate-900'}
                  group-hover:bg-slate-100 placeholder:text-slate-400 disabled:opacity-50`}
              />
              {error && (
                <div className="mt-2 flex items-center gap-1.5 px-1 animate-in slide-in-from-top-1">
                  <span className="material-symbols-outlined text-rose-500 text-sm">error</span>
                  <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">{error}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isCreating || !taskTitle.trim()}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                {isCreating ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                ) : (
                  <>
                    <span className="font-bold">{t('createTask.create') || 'Create'}</span>
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">add_circle</span>
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCreating}
                className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 rounded-xl font-bold transition-all"
              >
                {t('createTask.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
