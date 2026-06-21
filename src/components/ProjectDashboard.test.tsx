import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDashboard } from './ProjectDashboard';

const dashboardMock = vi.hoisted(() => ({
  setIsChartVisible: vi.fn(),
  registerViewportAnchorController: vi.fn(),
  consumePendingViewportAnchor: vi.fn(),
}));

vi.mock('../context/DashboardProvider', () => ({
  DashboardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    hasProject: true,
    isChartVisible: true,
    dashboardView: 'forecast',
    tasks: [],
    selectedTaskId: null,
    isCreateMode: false,
    isTaskDetailsOpen: true,  // set true to verify forecast guard hides details even if flag true
    setIsTaskDetailsOpen: vi.fn(),
    setIsCreateMode: vi.fn(),
    toast: null,
    hideToast: vi.fn(),
    dashboardItems: [],
    registerViewportAnchorController: dashboardMock.registerViewportAnchorController,
    consumePendingViewportAnchor: dashboardMock.consumePendingViewportAnchor,
    setIsChartVisible: dashboardMock.setIsChartVisible,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('./Header/Header', () => ({
  Header: () => <header>Header</header>,
}));

vi.mock('./Dashboard/TaskSidebar', () => ({
  TaskSidebar: () => <div>Task list</div>,
}));

vi.mock('./Dashboard/EmptyState', () => ({
  EmptyState: () => <div>Empty state</div>,
}));

vi.mock('./Dashboard/TaskDetailsPanel', () => ({
  TaskDetailsPanel: () => <div>Task details</div>,
}));

vi.mock('./Dashboard/FloatingSequenceBuilder', () => ({
  FloatingSequenceBuilder: () => <div>Sequence builder</div>,
}));

vi.mock('./Modals/StartDateUpdatePromptModal', () => ({
  StartDateUpdatePromptModal: () => <div>Start date prompt</div>,
}));

vi.mock('./Modals/OpenProjectModal', () => ({
  OpenProjectModal: () => null,
}));

vi.mock('./Modals/ConnectedAccountsModal', () => ({
  ConnectedAccountsModal: () => null,
}));

vi.mock('./Modals/PatAuthModal', () => ({
  PatAuthModal: () => null,
}));

vi.mock('./Modals/ProjectSettingsModal', () => ({
  ProjectSettingsModal: () => null,
}));

vi.mock('./Modals/AboutModal', () => ({
  AboutModal: () => null,
}));

vi.mock('./Modals/MissingFieldsPromptModal', () => ({
  MissingFieldsPromptModal: () => null,
}));

vi.mock('./UI/Toast', () => ({
  Toast: () => <div>Toast</div>,
}));

vi.mock('./Dashboard/Views/TimelineChart', () => ({
  TimelineChart: () => <div>Gantt chart</div>,
}));

vi.mock('./Dashboard/Views/ForecastDashboard', () => ({
  ForecastDashboard: () => <div>Forecast dashboard</div>,
}));

describe('ProjectDashboard responsive defaults', () => {
  beforeEach(() => {
    dashboardMock.setIsChartVisible.mockReset();
    dashboardMock.registerViewportAnchorController.mockReset();
    dashboardMock.consumePendingViewportAnchor.mockReset();
    dashboardMock.consumePendingViewportAnchor.mockReturnValue(null);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the forecast dashboard when that view is active', async () => {
    render(<ProjectDashboard />);

    expect(await screen.findByText('Forecast dashboard')).toBeTruthy();
    // Guard: even with isTaskDetailsOpen=true in mock, details should NOT render on forecast
    expect(screen.queryByText('Task details')).toBeNull();
    expect(dashboardMock.setIsChartVisible).not.toHaveBeenCalled();
  });
});
