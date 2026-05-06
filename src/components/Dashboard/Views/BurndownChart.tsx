import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { BurndownIcon } from './BurndownIcon';

export function BurndownChart({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { filteredTasks } = useDashboard();

  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-8 glass-panel bg-white/80 md:rounded-r-xl border md:border-y md:border-r border-slate-200/60 overflow-hidden relative ${className}`}>
      <div className="absolute inset-0 z-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      <div className="z-10 flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <BurndownIcon size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {t('dashboard.viewBurndown', 'Burndown Chart')}
        </h2>
        <p className="text-sm text-slate-500 mb-8">
          {t('dashboard.burndownChartPlaceholder', 'This feature is coming soon! It will allow you to track the remaining work in your project over time.')}
        </p>
        
        {/* Mock Stats */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Tasks</div>
            <div className="text-2xl font-extrabold text-slate-800">{filteredTasks.length}</div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <div className="text-[10px] font-bold text-orange-600/60 uppercase tracking-wider mb-1">Remaining</div>
            <div className="text-2xl font-extrabold text-orange-700">
              {filteredTasks.filter(t => t.status !== 'Done').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
