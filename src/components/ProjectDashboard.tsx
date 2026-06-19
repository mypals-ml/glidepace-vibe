import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../context/DashboardContext';
import { DashboardProvider } from '../context/DashboardProvider';
import {
  captureViewportAnchor,
  resolveViewportAnchor,
  DASHBOARD_ROW_HEIGHT_PX,
  VIEWPORT_ANCHOR_MAX_AGE_MS,
} from '../lib/viewportAnchor';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { Header } from './Header/Header';
import { TaskSidebar } from './Dashboard/TaskSidebar';
import { EmptyState } from './Dashboard/EmptyState';
import { useScrollSync } from '../hooks/useScrollSync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useMobileBackNavigation } from '../hooks/useMobileBackNavigation';
import { MissingFieldsPromptModal } from './Modals/MissingFieldsPromptModal';
import { Toast } from './UI/Toast';
import { FloatingSequenceBuilder } from './Dashboard/FloatingSequenceBuilder';
import { StartDateUpdatePromptModal } from './Modals/StartDateUpdatePromptModal';

const ConnectedAccountsModal = lazy(() => import('./Modals/ConnectedAccountsModal').then(m => ({ default: m.ConnectedAccountsModal })));
const OpenProjectModal = lazy(() => import('./Modals/OpenProjectModal').then(m => ({ default: m.OpenProjectModal })));
const PatAuthModal = lazy(() => import('./Modals/PatAuthModal').then(m => ({ default: m.PatAuthModal })));
const TaskDetailsPanel = lazy(() => import('./Dashboard/TaskDetailsPanel').then(m => ({ default: m.TaskDetailsPanel })));
const ProjectSettingsModal = lazy(() => import('./Modals/ProjectSettingsModal').then(m => ({ default: m.ProjectSettingsModal })));
const AboutModal = lazy(() => import('./Modals/AboutModal').then(m => ({ default: m.AboutModal })));
const TimelineChart = lazy(() => import('./Dashboard/Views/TimelineChart').then(m => ({ default: m.TimelineChart })));
const ForecastDashboard = lazy(() => import('./Dashboard/Views/ForecastDashboard').then(m => ({ default: m.ForecastDashboard })));


function DashboardLayout() {
  const { t } = useTranslation();
  const { hasProject, isChartVisible, dashboardView, tasks, selectedTaskId, isCreateMode, isTaskDetailsOpen, setIsTaskDetailsOpen, toast, hideToast, dashboardItems, registerViewportAnchorController, consumePendingViewportAnchor } = useDashboard();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { width: sidebarWidth, isResizing, panelRef, onMouseDown } = useResizablePanel();
  const { width: detailsWidth, panelRef: detailsPanelRef, onMouseDown: onMouseDownDetails } = useResizablePanel({
    direction: 'right',
    initialWidth: 416, // Approx 26rem
    minWidth: 320,
    maxWidth: 600
  });
  const { sidebarRef, timelineRef, onSidebarScroll, onTimelineScroll } = useScrollSync();
  useMobileBackNavigation(!isDesktop);

  // --- Viewport anchoring for background refreshes ---
  // This component owns the scroll refs, so it registers how to capture an
  // anchor (called by the refresh path right before applying a snapshot) and
  // restores the queued anchor right after the new dashboardItems render.
  const dashboardItemsRef = useRef(dashboardItems);
  useEffect(() => {
    dashboardItemsRef.current = dashboardItems;
  }, [dashboardItems]);

  useEffect(() => {
    registerViewportAnchorController(() => {
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return null;
      return captureViewportAnchor({
        dashboardItems: dashboardItemsRef.current,
        scrollTop: sidebarEl.scrollTop,
        viewportHeight: sidebarEl.clientHeight,
        rowHeight: DASHBOARD_ROW_HEIGHT_PX,
      });
    });
    return () => registerViewportAnchorController(null);
  }, [registerViewportAnchorController, sidebarRef]);

  useLayoutEffect(() => {
    const anchor = consumePendingViewportAnchor();
    if (!anchor) return;
    // Drop stale anchors (e.g. queued for a render that never used them).
    if (Date.now() - anchor.capturedAt > VIEWPORT_ANCHOR_MAX_AGE_MS) return;
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;

    const maxScrollTop = Math.max(0, sidebarEl.scrollHeight - sidebarEl.clientHeight);
    const nextScrollTop = resolveViewportAnchor({
      anchor,
      dashboardItems,
      rowHeight: DASHBOARD_ROW_HEIGHT_PX,
      maxScrollTop,
    });

    // Set both synced containers; useScrollSync no-ops when already equal.
    // Gantt horizontal scrollLeft is intentionally untouched.
    sidebarEl.scrollTop = nextScrollTop;
    if (timelineRef.current) {
      timelineRef.current.scrollTop = nextScrollTop;
    }
  }, [dashboardItems, consumePendingViewportAnchor, sidebarRef, timelineRef]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const shouldRenderTaskDetails = isTaskDetailsOpen && (isCreateMode || selectedTask !== null);
  const { setIsChartVisible } = useDashboard();
  const shouldShowTaskListPane = !isChartVisible || (isDesktop && dashboardView === 'gantt');


  // Keep the default view aligned with the available layout for each viewport.
  useEffect(() => {
    if (isDesktop) {
      setIsChartVisible(true);
    } else {
      // Narrow viewports open directly to the chart workspace; dashboardView
      // defaults to forecast, while users can still switch back to the list.
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
              className={`flex-shrink-0 lg:glass-panel md:rounded-l-xl flex-col z-10 h-full overflow-hidden bg-white/80 shadow-sm border-r md:border-y md:border-l border-slate-200/60 ${!isResizing ? 'transition-[width] duration-300' : ''} ${shouldShowTaskListPane ? 'flex w-full md:w-auto' : 'hidden'
                }`}
              style={{ width: isDesktop ? `${sidebarWidth}px` : (isChartVisible ? '0' : '100%') }}
              aria-label={t('dashboard.issuesList')}
            >
              <TaskSidebar scrollRef={sidebarRef} onScroll={onSidebarScroll} />
            </aside>

            {/* Resizer Handle (Left) */}
            {shouldShowTaskListPane && isDesktop && (
              <div
                className="w-1 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-0.5 flex items-center justify-center group"
                onMouseDown={onMouseDown}
                title="Drag to resize"
              >
                <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
              </div>
            )}

            {/* Main View Area */}
            <div className={`flex-1 flex flex-col min-w-0 overflow-hidden relative h-full ${isChartVisible ? 'flex' : 'hidden md:flex'}`}>
              <Suspense fallback={<DashboardViewLoading />}>
                {dashboardView === 'gantt' ? (
                  <TimelineChart
                    className="flex"
                    scrollRef={timelineRef}
                    onScroll={onTimelineScroll}
                  />
                ) : (
                  <ForecastDashboard
                    className="flex"
                  />
                )}
              </Suspense>
            </div>

            {/* Task Details Panel Section */}
            {shouldRenderTaskDetails && (
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
        <AboutModal />
        <MissingFieldsPromptModal />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
          />
        )}
      </Suspense>

      <FloatingSequenceBuilder className="hidden md:flex" />
      <StartDateUpdatePromptModal />

    </div>
  );
}

function DashboardViewLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white/60">
      <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
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
