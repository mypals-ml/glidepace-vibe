import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../context/DashboardContext';
import { DashboardProvider } from '../context/DashboardProvider';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { Header } from './Header/Header';
import { Sidebar } from './Dashboard/Sidebar';
import { Timeline } from './Dashboard/Timeline';
import { EmptyState } from './Dashboard/EmptyState';
import { useScrollSync } from '../hooks/useScrollSync';

const ConnectedAccountsModal = lazy(() => import('./Modals/ConnectedAccountsModal').then(m => ({ default: m.ConnectedAccountsModal })));
const OpenProjectModal = lazy(() => import('./Modals/OpenProjectModal').then(m => ({ default: m.OpenProjectModal })));
const PatAuthModal = lazy(() => import('./Modals/PatAuthModal').then(m => ({ default: m.PatAuthModal })));
const TaskDetailsPanel = lazy(() => import('./Dashboard/TaskDetailsPanel').then(m => ({ default: m.TaskDetailsPanel })));


function DashboardLayout() {
  const { t } = useTranslation();
  const { hasProject, isChartVisible, tasks, selectedTaskId, setSelectedTaskId } = useDashboard();
  const { width: sidebarWidth, isResizing, panelRef, onMouseDown } = useResizablePanel();
  const { sidebarRef, timelineRef, onSidebarScroll, onTimelineScroll } = useScrollSync();

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  return (
    <div className="bg-background-main text-slate-800 font-sans h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-10 w-full p-0 gap-0">
        {hasProject ? (
          <>
            {/* Sidebar: Issues List */}
            <aside
              ref={panelRef as React.RefObject<HTMLElement>}
              className={`flex-shrink-0 lg:glass-panel md:rounded-l-xl flex flex-col z-10 h-full overflow-hidden bg-white/80 shadow-sm border-r md:border-y md:border-l border-slate-200/60 ${!isResizing ? 'transition-[width] duration-300' : ''} ${isChartVisible ? 'hidden md:flex' : 'flex w-full md:w-auto'
                }`}
              style={{ width: window.innerWidth >= 768 ? `${sidebarWidth}px` : (isChartVisible ? '0' : '100%') }}
              aria-label={t('dashboard.issuesList')}
            >
              <Sidebar scrollRef={sidebarRef} onScroll={onSidebarScroll} />
            </aside>

            {/* Resizer Handle */}
            <div
              className="w-1 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-0.5 hidden md:flex items-center justify-center group"
              onMouseDown={onMouseDown}
              title="Drag to resize"
            >
              <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
            </div>

            {/* Timeline Region */}
            <Timeline 
              className={isChartVisible ? 'flex' : 'hidden md:flex'} 
              scrollRef={timelineRef} 
              onScroll={onTimelineScroll} 
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <TaskDetailsPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
        <OpenProjectModal />
        <ConnectedAccountsModal />
        <PatAuthModal />
      </Suspense>

    </div>
  );
}

export function GanttDashboard() {
  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  );
}
