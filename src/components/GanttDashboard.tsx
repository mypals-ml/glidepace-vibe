import { useTranslation } from 'react-i18next';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { Header } from './Header/Header';
import { ConnectedAccountsModal } from './Modals/ConnectedAccountsModal';
import { OpenProjectModal } from './Modals/OpenProjectModal';
import { Sidebar } from './Dashboard/Sidebar';
import { Timeline } from './Dashboard/Timeline';
import { EmptyState } from './Dashboard/EmptyState';

function DashboardLayout() {
  const { t } = useTranslation();
  const { hasProject, isChartVisible, isNarrowScreen } = useDashboard();
  const { width: sidebarWidth, onMouseDown } = useResizablePanel();

  return (
    <div className="bg-background-main text-slate-800 font-sans h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148,163,184,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-10 w-full p-4 gap-4">
        {hasProject ? (
          <>
            {/* Sidebar: Issues List */}
            <aside
              className={`flex-shrink-0 glass-panel rounded-xl flex flex-col z-10 h-full overflow-hidden bg-white/80 shadow-sm border border-slate-200/60 transition-[width] duration-300 ${
                isNarrowScreen ? (isChartVisible ? 'hidden' : 'flex w-full') : 'flex w-auto'
              }`}
              style={{ width: !isNarrowScreen ? `${sidebarWidth}px` : (isChartVisible ? '0' : '100%') }}
              aria-label={t('dashboard.issuesList')}
            >
              <Sidebar />
            </aside>

            {/* Resizer Handle */}
            <div
              className={`w-2 hover:bg-slate-300/50 cursor-col-resize z-20 transition-colors -mx-1 items-center justify-center group ${!isNarrowScreen ? 'flex' : 'hidden'}`}
              onMouseDown={onMouseDown}
              title="Drag to resize"
            >
              <div className="w-0.5 h-8 bg-slate-200 group-hover:bg-slate-400 rounded-full transition-colors"></div>
            </div>

            {/* Timeline Region */}
            <Timeline className={isNarrowScreen ? (isChartVisible ? 'flex' : 'hidden') : 'flex'} />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Modals */}
      <OpenProjectModal />
      <ConnectedAccountsModal />
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
