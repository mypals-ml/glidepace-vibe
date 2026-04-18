import { useDashboard } from '../../context/DashboardContext';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import type { Task, TaskStatus } from '../../types';

/** Fallback used before a project is loaded (demo without mock response yet, etc.) */
const DEFAULT_STATUSES = ['Todo', 'In Progress', 'Done'];

interface StatusSelectorProps {
  task: Task | null;
  onClose: () => void;
  onSelect?: (status: string) => void;
}

export function StatusSelector({ task, onClose, onSelect }: StatusSelectorProps) {
  const { updateTaskStatus, projectStatusOptions } = useDashboard();

  // Use project statuses from context; fall back to defaults if not yet loaded.
  const statuses = projectStatusOptions.length > 0 ? projectStatusOptions : DEFAULT_STATUSES;

  const handleSelectStatus = async (status: string) => {
    if (onSelect) {
      onSelect(status);
    } else if (task) {
      await updateTaskStatus(task, status as TaskStatus);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:absolute sm:inset-auto sm:left-0 sm:right-0 sm:top-full sm:mt-2 sm:p-0">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] sm:hidden" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Selector Panel */}
      <div className="glass-panel w-full rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 origin-top-right">
        {/* Status List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/30">
          {statuses.map(statusName => {
            const isSelected = task ? task.status === statusName : false;
            return (
              <button
                key={statusName}
                onClick={() => handleSelectStatus(statusName)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-primary/5 transition-colors group text-left"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 ${isSelected ? 'border-primary' : 'border-white'} ${getStatusColor(statusName)}`}>
                  <span className={`w-2 h-2 rounded-full ${getStatusDotColor(statusName)}`}></span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-medium text-slate-700 truncate">{statusName}</div>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer/Action (mobile only) */}
        <div className="p-2 border-t border-slate-200/60 bg-slate-50/80 flex justify-end items-center sm:hidden">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg shadow-glow hover:bg-primary-hover transition-all"
          >
            Done
          </button>
        </div>
      </div>
      
      {/* Invisible overlay for desktop click-outside */}
      <div 
        className="fixed inset-0 z-[-1] hidden sm:block" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
    </div>
  );
}
