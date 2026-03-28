import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';

export function Timeline() {
  const { t } = useTranslation();
  const { tasks, isLoadingTasks } = useDashboard();

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative z-10 glass-panel rounded-xl bg-white/80 shadow-sm border border-slate-200/60" aria-label="Timeline View" role="region">
      <div className="h-12 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex sticky top-0 z-20" aria-hidden="true">
        <div className="flex-1 flex text-[11px] font-semibold text-slate-500 select-none uppercase tracking-wider">
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.mon')}</span></div>
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.tue')}</span></div>
          <div className="flex-1 border-r border-slate-200 flex flex-col justify-center items-center bg-indigo-50/50 text-indigo-600 relative">
            <div className="absolute top-0 w-full h-0.5 bg-indigo-500"></div>
            <span>{t('days.wed')}</span>
            <span className="h-1 w-1 rounded-full bg-indigo-500 mt-0.5"></span>
          </div>
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.thu')}</span></div>
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center"><span>{t('days.fri')}</span></div>
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50/50 text-slate-400"><span>{t('days.sat')}</span></div>
          <div className="flex-1 border-r border-slate-100 flex flex-col justify-center items-center bg-slate-50/50 text-slate-400"><span>{t('days.sun')}</span></div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative custom-scrollbar bg-white/40">
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="flex-1 border-r border-slate-100"></div>
          <div className="flex-1 border-r border-slate-100"></div>
          <div className="flex-1 border-r border-indigo-100 bg-indigo-50/20"></div>
          <div className="flex-1 border-r border-slate-100"></div>
          <div className="flex-1 border-r border-slate-100"></div>
          <div className="flex-1 border-r border-slate-100 bg-slate-50/30"></div>
          <div className="flex-1 border-r border-slate-100 bg-slate-50/30"></div>
        </div>
        <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, transparent 49px, rgba(226, 232, 240, 0.4) 50px)', backgroundSize: '100% 50px' }}></div>

        <div className="relative w-full h-full pt-[5px] pb-10">
          {isLoadingTasks ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
                <span className="text-sm font-bold text-slate-500">{t('dashboard.loadingTasks')}</span>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm italic">
              {t('dashboard.noTasksInProject')}
            </div>
          ) : (
            <>
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minHeight: '400px' }}>
                <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>

              {tasks.map((task, idx) => {
                const leftPos = (idx * 15 + 5) % 80;
                const width = 20 + (idx * 10) % 40;

                return (
                  <div key={task.id} className="relative h-[50px] w-full flex items-center group z-10 px-2">
                    <div
                      className={`absolute h-8 rounded-md border flex items-center px-3 cursor-pointer transition-all shadow-sm ${
                        task.status === 'Done'
                          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50'
                          : task.status === 'In Progress'
                            ? 'bg-primary border-primary-hover shadow-glow hover:bg-primary-hover'
                            : 'bg-white border-slate-300 hover:bg-slate-50'
                      }`}
                      style={{
                        left: `${leftPos}%`,
                        width: `${width}%`,
                      }}
                    >
                      {task.status === 'In Progress' && <div className="w-1 h-5 bg-white/40 rounded-full mr-2"></div>}
                      <span className={`text-xs font-medium truncate ${
                        task.status === 'Done' ? 'text-emerald-700 opacity-70 line-through' : task.status === 'In Progress' ? 'text-white font-bold' : 'text-slate-600'
                      }`}>
                        {task.id} {task.title}
                      </span>
                      {task.status === 'Done' && (
                        <div className="ml-auto flex items-center">
                          <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                        </div>
                      )}
                      {task.status === 'In Progress' && (
                        <div className="ml-auto flex items-center gap-2">
                          <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full bg-white opacity-80" style={{ width: `${task.progress}%` }}></div>
                          </div>
                          <span className="text-[9px] font-bold text-white/90">{task.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
