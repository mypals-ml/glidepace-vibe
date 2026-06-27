import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForecastDashboard } from './ForecastDashboard';
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  normalizeForecastAssumptions,
  type ForecastAssumptions,
} from '../../../lib/forecastAssumptionsConfig';
import type { GitHubProject, Task } from '../../../types';

let isCompactViewport = false;
let isNarrowViewport = false;

const tasks: Task[] = [
  {
    kind: 'task',
    id: 'task-1',
    itemId: 'item-1',
    displayId: '#1',
    title: 'Task 1',
    status: 'Todo',
    startDate: '2026-06-19',
    targetDate: '2026-06-28',
    assignees: [],
    progress: 0,
    estimate: 10,
  },
];

const assignedTasks: Task[] = [
  {
    ...tasks[0],
    assignees: [{
      id: 'user-1',
      name: 'Ada',
      login: 'ada',
      initials: 'AD',
      avatarColor: '#4f46e5',
    }],
  },
];

type ForecastDashboardTestState = {
  filteredTasks: Task[];
  isLoadingTasks: boolean;
  selectedProject?: GitHubProject;
  forecastAssumptions: ForecastAssumptions;
  refreshForecastAssumptionsFromGitHub: ReturnType<typeof vi.fn>;
  saveForecastAssumptionsToGitHub: ReturnType<typeof vi.fn>;
  isLoadingForecastAssumptions: boolean;
  isRefreshingForecastAssumptions: boolean;
  isSavingForecastAssumptions: boolean;
};

function createDashboardState(
  overrides: Partial<ForecastDashboardTestState> = {},
): ForecastDashboardTestState {
  const state: ForecastDashboardTestState = {
    filteredTasks: tasks,
    isLoadingTasks: false,
    selectedProject: {
      id: 'project-1',
      title: 'Project Alpha',
      public: false,
      accountId: 'account-1',
    },
    forecastAssumptions: DEFAULT_FORECAST_ASSUMPTIONS,
    refreshForecastAssumptionsFromGitHub: vi.fn(),
    saveForecastAssumptionsToGitHub: vi.fn(),
    isLoadingForecastAssumptions: false,
    isRefreshingForecastAssumptions: false,
    isSavingForecastAssumptions: false,
    ...overrides,
  };

  if (!overrides.refreshForecastAssumptionsFromGitHub) {
    state.refreshForecastAssumptionsFromGitHub = vi.fn(async () => state.forecastAssumptions);
  }

  if (!overrides.saveForecastAssumptionsToGitHub) {
    state.saveForecastAssumptionsToGitHub = vi.fn(async (assumptions: ForecastAssumptions) => {
      state.forecastAssumptions = normalizeForecastAssumptions(assumptions);
      return true;
    });
  }

  return state;
}

let dashboardState = createDashboardState();

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | { defaultValue?: string; count?: string | number }) => {
        if (typeof fallback === 'string') return fallback || key;
        if (fallback && typeof fallback === 'object') {
          const template = fallback.defaultValue || key;
          return template.replace('{{count}}', String(fallback.count ?? ''));
        }
        return key;
      },
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../../context/DashboardContext', () => ({
  useDashboard: () => dashboardState,
}));

describe('ForecastDashboard loading state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-19T12:00:00Z'));
    localStorage.clear();
    sessionStorage.clear();
    isCompactViewport = false;
    isNarrowViewport = false;
    dashboardState = createDashboardState();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query === '(max-width: 639px)' ? isCompactViewport :
          query === '(max-width: 1023px)' ? isNarrowViewport :
          false,
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows section loading indicators while tasks are loading', () => {
    dashboardState = createDashboardState({
      filteredTasks: [],
      isLoadingTasks: true,
    });

    render(<ForecastDashboard />);

    expect(screen.getAllByRole('status', { name: 'dashboard.loadingTasks' })).toHaveLength(5);
  });

  it('renders the dashboard title without the eyebrow or subtitle copy', () => {
    render(<ForecastDashboard />);

    expect(screen.getByRole('heading', { name: 'Forecast Dashboard' }).className).toContain('pl-2');
    expect(screen.queryByText('Forecast')).toBeNull();
    expect(screen.queryByText('A stacked planning summary from the current filtered task set.')).toBeNull();
  });

  it('renders the assumptions heading in title case without uppercase styling', () => {
    render(<ForecastDashboard />);

    const heading = screen.getByRole('heading', { name: 'Assumptions' });
    expect(heading.className).not.toContain('uppercase');
    expect(heading.className).not.toContain('tracking-');
    expect(screen.queryByRole('button', { name: 'Forecast inputs' })).toBeNull();
  });

  it('labels the status workload section with the updated heading', () => {
    const { container } = render(<ForecastDashboard />);

    expect(screen.getByRole('heading', { name: 'Work Loads by Task Status' })).toBeTruthy();
    expect(screen.queryByText('Task Duration by Status')).toBeNull();

    const headingTexts = [...container.querySelectorAll('h2')].map((heading) => heading.textContent);
    expect(headingTexts.indexOf('Effort Remaining')).toBeLessThan(headingTexts.indexOf('Work Loads by Task Status'));
  });

  it('does not render the URL project loading placeholder in the burndown footer', () => {
    localStorage.setItem('project_history', JSON.stringify([{
      id: 'history-project-1',
      title: 'History Project',
      public: false,
      accountId: 'account-1',
      lastOpened: Date.now(),
    }]));
    dashboardState = createDashboardState({
      selectedProject: {
        id: 'url-project-1',
        title: 'Loading...',
        public: false,
        accountId: 'account-1',
      },
    });

    render(<ForecastDashboard />);

    expect(screen.queryByText('Loading...')).toBeNull();
    expect(screen.getByText('History Project')).toBeTruthy();
  });

  it('opens an explanation dialog from the burndown chart info button', () => {
    render(<ForecastDashboard />);

    expect(screen.getByText('Projected completion from current assumptions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'How the burndown chart is calculated' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How the forecast is calculated' })).toBeTruthy();
    expect(screen.getByText('The projected line simulates future workday burn-down from today using the same worker allocation and capacity. The line reaches zero on the estimated completion date.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens an assumptions storage dialog from the assumptions info button', () => {
    render(<ForecastDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Where assumptions are saved' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Where assumptions are saved' })).toBeTruthy();
    expect(screen.getByText('Shared assumptions are saved in the GitHub Project README. The app writes a small namespaced JSON block through GitHub Projects, so teammates opening the same project can load the same settings.')).toBeTruthy();
    expect(screen.getByText('A per-project browser cache is also kept in localStorage. It makes reloads faster and provides the last known assumptions when GitHub cannot be reached.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens explanation dialogs for effort remaining and workload status sections', () => {
    render(<ForecastDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'How effort remaining is calculated' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How effort remaining is calculated' })).toBeTruthy();
    expect(screen.getByText('Remaining effort uses task estimates when available, otherwise task duration. Each open task is weighted by the remaining-workload percentage configured in Assumptions.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'How workload by task status is calculated' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How workload by task status is calculated' })).toBeTruthy();
    expect(screen.getByText('This section groups the project effort by each task status, such as Done, Draft, Todo, In progress, and other project-specific statuses.')).toBeTruthy();
  });

  it('hides top worker loads when the project has no real assignees', () => {
    render(<ForecastDashboard />);

    expect(screen.queryByRole('heading', { name: 'Top worker loads' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Project assignees' }).textContent).toContain('0');
    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).value).toBe('0');
  });

  it('omits intermediate worker date labels in compact layouts', () => {
    isCompactViewport = true;
    isNarrowViewport = true;
    dashboardState = createDashboardState({
      filteredTasks: assignedTasks,
    });

    const { container } = render(<ForecastDashboard />);

    expect(container.querySelector('span[title="2026-06-19"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-20"]')).toBeNull();
    expect(container.querySelector('span[title="2026-06-22"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-25"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-28"]')).toBeTruthy();
  });

  it('keeps assumptions read-only until edit is enabled', () => {
    render(<ForecastDashboard />);

    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Capacity per worker') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Todo') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('lets users edit and save assumptions after entering edit mode', async () => {
    dashboardState = createDashboardState({
      filteredTasks: assignedTasks,
    });
    const { rerender } = render(<ForecastDashboard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    });
    rerender(<ForecastDashboard />);

    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    const availableWorkersInput = screen.getByLabelText('Available Workers');
    expect((availableWorkersInput as HTMLInputElement).readOnly).toBe(false);
    expect((availableWorkersInput as HTMLInputElement).value).toBe('1');
    fireEvent.change(availableWorkersInput, { target: { value: '2' } });
    rerender(<ForecastDashboard />);
    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).value).toBe('2');

    const capacityInput = screen.getByLabelText('Capacity per worker');
    expect((capacityInput as HTMLInputElement).readOnly).toBe(false);
    fireEvent.change(capacityInput, { target: { value: '4' } });
    rerender(<ForecastDashboard />);
    expect((screen.getByLabelText('Capacity per worker') as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText('Capacity of the team') as HTMLInputElement).value).toBe('8 d / week');

    const todoInput = screen.getByLabelText('Todo');
    fireEvent.change(todoInput, { target: { value: '75' } });
    rerender(<ForecastDashboard />);
    expect((screen.getByLabelText('Todo') as HTMLInputElement).value).toBe('75');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(dashboardState.saveForecastAssumptionsToGitHub).toHaveBeenCalledWith(
      expect.objectContaining({
        capacityDaysPerWeek: 4,
        availableWorkers: 2,
        statusRemainingPercent: expect.objectContaining({ todo: 75 }),
      }),
    );
  });

  it('cancels assumption edits without saving changes', async () => {
    dashboardState = createDashboardState({
      filteredTasks: assignedTasks,
    });
    const { rerender } = render(<ForecastDashboard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    });
    rerender(<ForecastDashboard />);

    fireEvent.change(screen.getByLabelText('Available Workers'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Capacity per worker'), { target: { value: '4' } });
    rerender(<ForecastDashboard />);
    expect((screen.getByLabelText('Capacity of the team') as HTMLInputElement).value).toBe('8 d / week');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    rerender(<ForecastDashboard />);

    expect(dashboardState.saveForecastAssumptionsToGitHub).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Capacity per worker') as HTMLInputElement).value).toBe('5');
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows all unique project assignees in the assignee dropdown', () => {
    dashboardState = createDashboardState({
      filteredTasks: [
        {
          ...tasks[0],
          assignees: [
            { id: 'user-1', name: 'Ada', login: 'ada', initials: 'AD', avatarColor: '#4f46e5' },
            { id: 'user-2', name: 'Grace', login: 'grace', initials: 'GH', avatarColor: '#0f766e' },
          ],
        },
        {
          ...tasks[0],
          id: 'task-2',
          assignees: [
            { id: 'user-1', name: 'Ada', login: 'ada', initials: 'AD', avatarColor: '#4f46e5' },
          ],
        },
      ],
    });

    render(<ForecastDashboard />);

    const assigneeControl = screen.getByRole('button', { name: 'Project assignees' });
    expect(assigneeControl.textContent).toContain('2');
    expect((screen.getByLabelText('Available Workers') as HTMLInputElement).value).toBe('2');
    fireEvent.click(assigneeControl);

    const listbox = screen.getByRole('listbox', { name: 'Project assignees list' });
    expect(within(listbox).getByText('Ada')).toBeTruthy();
    expect(within(listbox).getByText('@ada')).toBeTruthy();
    expect(within(listbox).getByText('Grace')).toBeTruthy();
    expect(within(listbox).getByText('@grace')).toBeTruthy();
  });

  it('translates status legend labels via exact match and status-key fallback', () => {
    dashboardState = createDashboardState({
      filteredTasks: [{
        ...tasks[0],
        status: 'Ready for deploy',
        progress: 0,
      }],
    });

    render(<ForecastDashboard />);

    expect(screen.getAllByText('Todo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ready for deploy')).toBeNull();
  });

  it('uses muted styling for read-only status workload assumptions', () => {
    render(<ForecastDashboard />);

    expect(screen.getByLabelText('Draft').closest('label')?.className).toContain('bg-slate-50/90');
    expect(screen.getByLabelText('Todo').closest('label')?.className).toContain('bg-slate-50/90');
    expect(screen.getByLabelText('In progress').closest('label')?.className).toContain('bg-slate-50/90');
  });

  it('uses matching colors for status workload assumptions in edit mode', async () => {
    const { rerender } = render(<ForecastDashboard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    });
    rerender(<ForecastDashboard />);

    expect(screen.getByLabelText('Draft').closest('label')?.className).toContain('bg-slate-100');
    expect(screen.getByLabelText('Todo').closest('label')?.className).toContain('bg-slate-100');
    expect(screen.getByLabelText('In progress').closest('label')?.className).toContain('bg-yellow-50');
    expect(screen.getByLabelText('In review').closest('label')?.className).toContain('bg-yellow-50');
    expect(screen.getByLabelText('Done').closest('label')?.className).toContain('bg-purple-100');
    expect(screen.getByLabelText('Other').closest('label')?.className).toContain('bg-slate-100');
  });

  it('anchors start and completion labels and side-places today when distinct', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 19));
    dashboardState = createDashboardState({
      filteredTasks: [{
        ...tasks[0],
        startDate: '2026-06-18',
        targetDate: '2026-06-22',
        estimate: 3,
      }],
    });

    render(<ForecastDashboard />);
    const xAxisLabels = screen.getByTestId('burndown-x-axis-labels');

    expect(within(xAxisLabels).getByText('Jun 18').className).toContain('left-0');
    expect(within(xAxisLabels).getByText('Jun 24').className).toContain('right-0');
    expect(within(xAxisLabels).getByText('Jun 19').className).toContain('translate-x-2');
  });

  it('omits the today label when today is the start date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 19));

    render(<ForecastDashboard />);

    expect(within(screen.getByTestId('burndown-x-axis-labels')).getAllByText('Jun 19')).toHaveLength(1);
  });
});
