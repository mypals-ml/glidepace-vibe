import { useState, useRef, useEffect } from 'react';
import { DUMMY_TASKS } from '../lib/dummyData';
import { useTranslation } from 'react-i18next';

export function GanttDashboard() {
  const { t, i18n } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [hasProject, setHasProject] = useState(false);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.userSelect = '';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX - 16;
    if (newWidth >= 250 && newWidth <= 800) {
      setSidebarWidth(newWidth);
    }
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="bg-background-main text-slate-800 font-sans h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="glass-panel border-b border-surface-border px-6 py-3 flex items-center justify-between z-20 sticky top-0 bg-white/70 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('app.name')}</h1>
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-3">
            <div className="relative flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
              <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500" id="project-select-label">{t('app.projectLabel')}</div>
              <select 
                className="border-0 focus:ring-0 text-sm py-1.5 px-3 w-40 text-slate-700 font-medium focus:outline-none bg-transparent appearance-none cursor-pointer"
                value={hasProject ? "dummy" : "empty"}
                onChange={(e) => setHasProject(e.target.value === "dummy")}
                aria-labelledby="project-select-label"
              >
                <option value="empty">{t('app.emptyProjectOption')}</option>
                <option value="dummy">{t('app.dummyProjectOption')}</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]" aria-hidden="true">expand_more</span>
            </div>

            <div className="relative flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
              <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500" id="language-select-label">{t('app.language')}</div>
              <select 
                className="border-0 focus:ring-0 text-sm py-1.5 pl-3 pr-8 w-28 text-slate-700 font-medium focus:outline-none bg-transparent appearance-none cursor-pointer"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                aria-labelledby="language-select-label"
              >
                <option value="en">EN</option>
                <option value="ja">日本語</option>
                <option value="zh-CN">中文</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]" aria-hidden="true">language</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-700 shadow-sm">
             <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {t('app.syncedJustNow')}
          </div>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors text-sm font-medium shadow-sm"
            aria-label={t('app.signInWithGitHub')}
          >
            <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path></svg>
            {t('app.signInWithGitHub')}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-10 w-full p-4 gap-4">
        {hasProject ? (
          <>
        
        {/* Sidebar: Issues List */}
        <aside style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 glass-panel rounded-xl flex flex-col z-10 h-full overflow-hidden hidden md:flex bg-white/80 shadow-sm border border-slate-200/60" aria-label={t('dashboard.issuesList')}>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse" aria-label={t('dashboard.issuesList')}>
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-12">{t('table.id')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">{t('table.title')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-24">{t('table.status')}</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-20 text-center">{t('table.assignees')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DUMMY_TASKS.map(task => (
                  <tr key={task.id} className={`h-[50px] hover:bg-slate-50/80 transition-colors cursor-pointer group bg-white relative`} tabIndex={0} aria-label={`${task.title} - ${t('table.status')} ${task.status}`}>
                    <td className="px-4 py-0 text-xs text-slate-400 font-mono align-middle relative">
                      {task.status === 'In Progress' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-inprogress-highlight" aria-hidden="true"></div>}
                      {task.status === 'Done' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-done-highlight" aria-hidden="true"></div>}
                      {task.status === 'Todo' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-todo-highlight" aria-hidden="true"></div>}
                      {task.id}
                    </td>
                    <td className="px-4 py-0 align-middle">
                      <span className={`text-sm font-medium transition-colors block leading-tight ${task.status === 'Done' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-700 group-hover:text-primary'}`}>{task.title}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{task.startDate} - {task.endDate}</div>
                    </td>
                    <td className="px-4 py-0 align-middle">
                      {task.status === 'Done' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-done-bg text-status-done-text border border-status-done-border">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-done-highlight mr-1.5"></span>{t('taskStatuses.done')}
                        </span>
                      )}
                      {task.status === 'In Progress' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border">
                           <span className="w-1.5 h-1.5 rounded-full bg-status-inprogress-highlight mr-1.5 animate-pulse"></span>{t('taskStatuses.inProgress')}
                        </span>
                      )}
                      {task.status === 'Todo' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-todo-bg text-status-todo-text border border-status-todo-border">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-todo-highlight mr-1.5"></span>{t('taskStatuses.todo')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top pt-3">
                      <div className="flex justify-center -space-x-1.5">
                        {task.assignees.map((user, idx) => (
                           <div key={user.id} className={`w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold ${user.avatarColor}`} style={{ zIndex: 10 - idx }} title={user.name}>{user.initials}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Bottom Search Box */}
          <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md mt-auto">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">search</span>
              <input className="w-full bg-white border border-slate-200 shadow-sm rounded-md pl-9 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder={t('dashboard.filterPlaceholder')} aria-label={t('dashboard.filterPlaceholder')} type="text" />
            </div>
          </div>
        </aside>

        {/* Resizer Handle */}
        <div
          className="w-2 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-1 flex items-center justify-center group"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
        </div>

        {/* Timeline Region */}
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
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minHeight: '400px' }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {/* Basic static arrows to match dummy data flow */}
                  <path d="M 28% 25 C 32% 25, 32% 75, 36% 75" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)"></path>
                  <path d="M 64% 75 C 68% 75, 68% 125, 72% 125" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)"></path>
                </svg>

                {/* Simulated row for Task 1 */}
                <div className="relative h-[50px] w-full flex items-center group z-10 px-2">
                  <div className="absolute left-0 w-[28%] ml-2 h-8 rounded-md bg-emerald-50 border border-emerald-200 flex items-center px-3 cursor-pointer hover:bg-emerald-100/50 transition-colors shadow-sm">
                    <span className="text-xs font-medium text-emerald-700 truncate opacity-70 line-through">#138 Implement UI</span>
                    <div className="ml-auto flex items-center">
                      <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                    </div>
                  </div>
                </div>

                {/* Simulated row for Task 2 */}
                <div className="relative h-[50px] w-full flex items-center group z-10 px-2">
                  <div className="absolute left-[29%] w-[50%] h-9 rounded-lg bg-primary border border-primary-hover flex items-center px-3 shadow-glow cursor-pointer hover:bg-primary-hover transition-all">
                    <div className="w-1 h-5 bg-white/40 rounded-full mr-2"></div>
                    <span className="text-sm font-semibold text-white truncate">#142 Refactor API Auth Layer</span>
                    <div className="ml-auto flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                         <div className="h-full bg-white w-[65%] rounded-full"></div>
                       </div>
                       <span className="text-[10px] font-bold text-white/90">65%</span>
                    </div>
                  </div>
                </div>

                {/* Simulated row for Task 3 */}
                <div className="relative h-[50px] w-full flex items-center group z-10 px-2">
                  <div className="absolute left-[72%] w-[25%] h-8 rounded-md bg-white border border-slate-300 flex items-center px-3 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                    <span className="text-xs font-medium text-slate-600 truncate">#145 DB Schema Update</span>
                  </div>
                </div>
              </div>
           </div>
        </main>
          </>
        ) : (
          <div className="flex-1 flex overflow-hidden glass-panel bg-white/80 shadow-sm border border-slate-200/60 rounded-xl">
             <div className="w-1/3 min-w-[350px] bg-white border-r border-slate-200/60 flex flex-col items-center justify-center p-8">
                <div className="w-16 h-16 rounded-full border border-dashed border-slate-300 flex items-center justify-center mb-4 text-slate-400" aria-hidden="true">
                  <span className="material-symbols-outlined text-3xl">folder_off</span>
                </div>
                <h2 className="text-lg font-semibold mb-1 text-slate-800">{t('dashboard.emptyStateTitle')}</h2>
                <p className="text-sm text-slate-500 mb-6 text-center">{t('dashboard.emptyStateDesc')}</p>
                <button
                  onClick={() => setHasProject(true)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                  aria-label={t('dashboard.addProjectButton')}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
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
        )}
      </div>
    </div>
  );
}
