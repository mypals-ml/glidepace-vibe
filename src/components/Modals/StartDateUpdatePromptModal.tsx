import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';

export function StartDateUpdatePromptModal() {
  const { t } = useTranslation();
  const { 
    isStartDatePromptOpen, 
    startDatePromptTasks, 
    onStartDatePromptDecision 
  } = useDashboard();

  if (!isStartDatePromptOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-indigo-600 text-2xl">calendar_month</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {t('dashboard.batchUpdatePromptTitle')}
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {t('dashboard.batchUpdatePromptDesc')}
          </p>
          
          <div className="max-h-40 overflow-y-auto mb-6 space-y-2 pr-1 custom-scrollbar">
            {startDatePromptTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{task.displayId}</span>
                <span className="text-xs font-medium text-slate-700 truncate">{task.title}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              variant="primary" 
              fullWidth
              onClick={() => onStartDatePromptDecision('auto', startDatePromptTasks)}
            >
              {t('dashboard.batchUpdateAutoUpdateNonLocked')}
            </Button>
            <Button 
              variant="ghost" 
              fullWidth
              onClick={() => onStartDatePromptDecision('ask', startDatePromptTasks)}
            >
              {t('dashboard.batchUpdateAskEveryTime')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
