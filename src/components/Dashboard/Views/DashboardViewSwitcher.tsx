import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { BurndownIcon } from './BurndownIcon';

/**
 * View switcher for the dashboard header.
 * Does NOT wrap itself in OverflowItem — that is done by the parent Header.
 */
export function DashboardViewSwitcher() {
  const { t } = useTranslation();
  const { 
    dashboardView, 
    setDashboardView, 
    isChartVisible, 
    setIsChartVisible 
  } = useDashboard();

  const currentTab = !isChartVisible ? 'list' : dashboardView;

  const handleSwitch = (view: 'list' | 'gantt' | 'burndown') => {
    if (view === 'list') {
      setIsChartVisible(false);
    } else {
      setIsChartVisible(true);
      setDashboardView(view);
    }
  };

  const baseBtnClass = "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 relative z-10";
  const activeBtnClass = "bg-white text-primary shadow-sm ring-1 ring-slate-200/60";
  const inactiveBtnClass = "text-slate-500 hover:text-slate-700 hover:bg-white/50";

  return (
    <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-lg border border-slate-200/60 shadow-sm self-center">
      {/* List View - Only visible on mobile/tablet */}
      <button
        onClick={() => handleSwitch('list')}
        className={`${baseBtnClass} md:hidden ${
          currentTab === 'list' ? activeBtnClass : inactiveBtnClass
        }`}
        title={t('dashboard.viewList', 'List')}
      >
        <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
      </button>

      {/* Forecast View */}
      <button
        onClick={() => handleSwitch('burndown')}
        className={`${baseBtnClass} ${
          currentTab === 'burndown' ? activeBtnClass : inactiveBtnClass
        }`}
        title={t('dashboard.viewBurndown', 'Forecast')}
      >
        <BurndownIcon size={18} />
      </button>

      {/* Timeline View */}
      <button
        onClick={() => handleSwitch('gantt')}
        className={`${baseBtnClass} ${
          currentTab === 'gantt' ? activeBtnClass : inactiveBtnClass
        }`}
        title={t('dashboard.viewGantt', 'Gantt')}
      >
        <span 
          className="material-symbols-outlined text-[18px] inline-block"
          style={{ transform: 'scaleX(-1)' }}
        >
          view_timeline
        </span>
      </button>
    </div>
  );
}
