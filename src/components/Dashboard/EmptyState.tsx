import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';

export function EmptyState() {
  const { t } = useTranslation();
  const { handleOpenProjectClick } = useDashboard();

  return (
    <div className="flex-1 flex overflow-hidden glass-panel bg-white/80 shadow-sm border border-slate-200/60 rounded-xl">
      <div className="w-1/3 min-w-[350px] bg-white border-r border-slate-200/60 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full border border-dashed border-slate-300 flex items-center justify-center mb-4 text-slate-400" aria-hidden="true">
          <span className="material-symbols-outlined text-3xl">folder_off</span>
        </div>
        <h2 className="text-lg font-semibold mb-1 text-slate-800">{t('dashboard.emptyStateTitle')}</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">{t('dashboard.emptyStateDesc')}</p>
        <button
          onClick={handleOpenProjectClick}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          aria-label={t('dashboard.addProjectButton')}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">folder_open</span>
          {t('dashboard.addProjectButton')}
        </button>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50/50">
        <div className="h-12 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex shadow-sm z-10" aria-hidden="true">
          <div className="flex-1 flex text-[11px] font-semibold text-slate-500 select-none uppercase tracking-wider">
            <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.mon')}</span></div>
            <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.tue')}</span></div>
            <div className="flex-1 border-r border-slate-200 flex flex-col justify-center items-center bg-indigo-50/50 text-indigo-600 relative">
              <div className="absolute top-0 w-full h-0.5 bg-indigo-500"></div>
              <span>{t('days.wed')}</span>
            </div>
            <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.thu')}</span></div>
            <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.fri')}</span></div>
            <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50 text-slate-400"><span>{t('days.sat')}</span></div>
            <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 text-slate-400"><span>{t('days.sun')}</span></div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4" aria-hidden="true">calendar_month</span>
          <p className="text-slate-500 font-medium">{t('dashboard.addProjectTimelinePrompt')}</p>
        </div>
      </div>
    </div>
  );
}
