import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { getStatusColor } from '../../utils/statusColors';

export function Timeline({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { filteredTasks, isLoadingTasks } = useDashboard();

  return (
    <main className={`flex-1 flex-col overflow-hidden relative z-10 glass-panel md:rounded-r-xl bg-white/80 shadow-sm border md:border-y md:border-r border-slate-200/60 ${className}`} aria-label="Timeline View" role="region">
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
          ) : filteredTasks.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm italic">
              {t('dashboard.noMatchingTasks')}
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

              {filteredTasks.map((task, idx) => {
                const leftPos = (idx * 15 + 5) % 80;
                const width = 20 + (idx * 10) % 40;

                return (
                  <div key={task.id} className="relative h-[50px] w-full flex items-center group z-10 px-2">
                  <div
                      className={`absolute h-8 rounded-md border flex items-center px-3 cursor-pointer transition-all shadow-sm hover:opacity-80 ${getStatusColor(task.status)}`}
                      style={{
                        left: `${leftPos}%`,
                        width: `${width}%`,
                      }}
                    >
                      <span className="text-xs font-medium truncate">
                        {task.id} {task.title}
                      </span>
                      {task.progress === 100 && (
                        <div className="ml-auto flex items-center">
                          <span className="material-symbols-outlined text-[14px] opacity-70">check_circle</span>
                        </div>
                      )}
                      {task.progress > 0 && task.progress < 100 && (
                        <div className="ml-auto flex items-center gap-2">
                          <div className="w-12 h-1 bg-black/10 rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full opacity-70" style={{ width: `${task.progress}%`, backgroundColor: 'currentColor' }}></div>
                          </div>
                          <span className="text-[9px] font-bold opacity-80">{task.progress}%</span>
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
