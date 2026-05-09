import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../context/DashboardContext';
import { DashboardProvider } from '../context/DashboardProvider';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { Header } from './Header/Header';
import { TaskSidebar } from './Dashboard/TaskSidebar';
import { GanttChart } from './Dashboard/Views/GanttChart';
import { BurndownChart } from './Dashboard/Views/BurndownChart';
import { EmptyState } from './Dashboard/EmptyState';
import { useScrollSync } from '../hooks/useScrollSync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MissingFieldsPromptModal } from './Modals/MissingFieldsPromptModal';
import { Toast } from './UI/Toast';
import { FloatingSequenceBuilder } from './Dashboard/FloatingSequenceBuilder';

const ConnectedAccountsModal = lazy(() => import('./Modals/ConnectedAccountsModal').then(m => ({ default: m.ConnectedAccountsModal })));
const OpenProjectModal = lazy(() => import('./Modals/OpenProjectModal').then(m => ({ default: m.OpenProjectModal })));
const PatAuthModal = lazy(() => import('./Modals/PatAuthModal').then(m => ({ default: m.PatAuthModal })));
const TaskDetailsPanel = lazy(() => import('./Dashboard/TaskDetailsPanel').then(m => ({ default: m.TaskDetailsPanel })));
const ProjectSettingsModal = lazy(() => import('./Modals/ProjectSettingsModal').then(m => ({ default: m.ProjectSettingsModal })));


function DashboardLayout() {
  const { t } = useTranslation();
  const { hasProject, isChartVisible, dashboardView, tasks, selectedTaskId, isTaskDetailsOpen, setIsTaskDetailsOpen, toast, hideToast } = useDashboard();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { width: sidebarWidth, isResizing, panelRef, onMouseDown } = useResizablePanel();
  const { width: detailsWidth, panelRef: detailsPanelRef, onMouseDown: onMouseDownDetails } = useResizablePanel({
    direction: 'right',
    initialWidth: 416, // Approx 26rem
    minWidth: 320,
    maxWidth: 600
  });
  const { sidebarRef, timelineRef, onSidebarScroll, onTimelineScroll } = useScrollSync();

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const { setIsChartVisible } = useDashboard();


  // Ensure charts are considered "visible" on desktop to sync state with layout
  useEffect(() => {
    if (isDesktop) {
      setIsChartVisible(true);
    }
  }, [isDesktop, setIsChartVisible]);

  return (
    <div className="bg-background-main text-slate-800 font-sans h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative w-full p-0 gap-0">
        {hasProject ? (
          <>
            {/* Sidebar: Issues List */}
            <aside
              ref={panelRef as React.RefObject<HTMLElement>}
              className={`flex-shrink-0 lg:glass-panel md:rounded-l-xl flex flex-col z-10 h-full overflow-hidden bg-white/80 shadow-sm border-r md:border-y md:border-l border-slate-200/60 ${!isResizing ? 'transition-[width] duration-300' : ''} ${isChartVisible ? 'hidden md:flex' : 'flex w-full md:w-auto'
                }`}
              style={{ width: isDesktop ? `${sidebarWidth}px` : (isChartVisible ? '0' : '100%') }}
              aria-label={t('dashboard.issuesList')}
            >
              <TaskSidebar scrollRef={sidebarRef} onScroll={onSidebarScroll} />
            </aside>

            {/* Resizer Handle (Left) */}
            <div
              className="w-1 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-0.5 hidden md:flex items-center justify-center group"
              onMouseDown={onMouseDown}
              title="Drag to resize"
            >
              <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
            </div>

            {/* Main View Area */}
            <div className={`flex-1 flex flex-col min-w-0 overflow-hidden relative h-full ${isChartVisible ? 'flex' : 'hidden md:flex'}`}>
              {dashboardView === 'gantt' ? (
                <GanttChart
                  className="flex"
                  scrollRef={timelineRef}
                  onScroll={onTimelineScroll}
                />
              ) : (
                <BurndownChart
                  className="flex"
                />
              )}
            </div>

            {/* Task Details Panel Section */}
            {isTaskDetailsOpen && (
              isDesktop ? (
                <>
                  {/* Resizer Handle (Right) - Only on Desktop */}
                  <div
                    className="w-1 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-0.5 flex items-center justify-center group"
                    onMouseDown={onMouseDownDetails}
                    title="Drag to resize"
                  >
                    <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
                  </div>

                  <aside
                    ref={detailsPanelRef as React.RefObject<HTMLElement>}
                    className="flex-shrink-0 h-full border-l border-slate-200/60 bg-white/80 lg:glass-panel md:rounded-r-xl overflow-hidden"
                    style={{ width: `${detailsWidth}px` }}
                  >
                    <TaskDetailsPanel
                      task={selectedTask}
                      onClose={() => setIsTaskDetailsOpen(false)}
                      isInline={true}
                    />
                  </aside>
                </>
              ) : (
                /* Mobile Overlay Mode */
                <TaskDetailsPanel
                  task={selectedTask}
                  onClose={() => setIsTaskDetailsOpen(false)}
                  isInline={false}
                />
              )
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <OpenProjectModal />
        <ConnectedAccountsModal />
        <PatAuthModal />
        <ProjectSettingsModal />
        <MissingFieldsPromptModal />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
          />
        )}
      </Suspense>

      <FloatingSequenceBuilder />

    </div>
  );
}

export function ProjectDashboard() {
  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  );
}
