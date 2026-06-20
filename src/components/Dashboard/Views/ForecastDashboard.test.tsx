import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForecastDashboard } from './ForecastDashboard';
import type { Task } from '../../../types';

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

let dashboardState = {
  filteredTasks: tasks,
  isLoadingTasks: false,
};

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback || key,
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
    isCompactViewport = false;
    isNarrowViewport = false;
    dashboardState = {
      filteredTasks: tasks,
      isLoadingTasks: false,
    };
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
    dashboardState = {
      filteredTasks: [],
      isLoadingTasks: true,
    };

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
    render(<ForecastDashboard />);

    expect(screen.getByRole('heading', { name: 'Work Loads by Task Status' })).toBeTruthy();
    expect(screen.queryByText('Task Duration by Status')).toBeNull();
  });

  it('opens an explanation dialog from the estimated completion info button', () => {
    render(<ForecastDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'How forecast calculations work' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How the forecast is calculated' })).toBeTruthy();
    expect(screen.getByText('The projected line simulates future workday burn-down from today using the same worker allocation and capacity. The line reaches zero on the estimated completion date.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides top worker loads when the project has no real assignees', () => {
    render(<ForecastDashboard />);

    expect(screen.queryByRole('heading', { name: 'Top worker loads' })).toBeNull();
    expect((screen.getByLabelText('Workers') as HTMLInputElement).value).toBe('1');
  });

  it('omits intermediate worker date labels in compact layouts', () => {
    isCompactViewport = true;
    isNarrowViewport = true;
    dashboardState = {
      filteredTasks: assignedTasks,
      isLoadingTasks: false,
    };

    const { container } = render(<ForecastDashboard />);

    expect(container.querySelector('span[title="2026-06-19"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-20"]')).toBeNull();
    expect(container.querySelector('span[title="2026-06-22"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-25"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-28"]')).toBeTruthy();
  });

  it('lets users edit capacity and status assumptions while derived fields stay read-only', () => {
    render(<ForecastDashboard />);

    const startDateInput = screen.getByLabelText('Start date');
    expect((startDateInput as HTMLInputElement).value).toBe('2026/06/19');
    expect((startDateInput as HTMLInputElement).readOnly).toBe(true);
    expect(startDateInput.className).toContain('bg-slate-50');
    expect(startDateInput.className).not.toContain('shadow');

    const capacityInput = screen.getByLabelText('Capacity');
    fireEvent.change(capacityInput, { target: { value: '4' } });
    expect((capacityInput as HTMLInputElement).value).toBe('4');

    const todoInput = screen.getByLabelText('Todo');
    fireEvent.change(todoInput, { target: { value: '75' } });
    expect((todoInput as HTMLInputElement).value).toBe('75');
    expect(todoInput.closest('label')?.className).toContain('bg-slate-100');
    expect(todoInput.parentElement?.className).not.toContain('shadow');

    const workersInput = screen.getByLabelText('Workers');
    expect((workersInput as HTMLInputElement).value).toBe('1');
    expect((workersInput as HTMLInputElement).readOnly).toBe(true);
    expect(workersInput.className).toContain('bg-slate-50');
    expect(workersInput.className).not.toContain('shadow');
  });

  it('uses matching colors for status workload assumptions', () => {
    render(<ForecastDashboard />);

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
    dashboardState = {
      filteredTasks: [{
        ...tasks[0],
        startDate: '2026-06-18',
        targetDate: '2026-06-22',
        estimate: 3,
      }],
      isLoadingTasks: false,
    };

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
