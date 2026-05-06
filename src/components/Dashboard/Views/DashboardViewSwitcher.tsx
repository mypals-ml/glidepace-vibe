import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';

export function DashboardViewSwitcher() {
  const { t } = useTranslation();
  const { dashboardView, setDashboardView } = useDashboard();

  return (
    <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-lg border border-slate-200/60 shadow-sm self-center">
      <button
        onClick={() => setDashboardView('gantt')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          dashboardView === 'gantt'
            ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/60'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">format_align_left</span>
        {t('dashboard.viewGantt', 'Gantt Chart')}
      </button>
      <button
        onClick={() => setDashboardView('burnup')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          dashboardView === 'burnup'
            ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/60'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">analytics</span>
        {t('dashboard.viewBurnUp', 'Burn Up')}
      </button>
    </div>
  );
}
