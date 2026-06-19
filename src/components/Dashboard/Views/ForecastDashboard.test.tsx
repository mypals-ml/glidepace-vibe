import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('shows section loading indicators while tasks are loading', () => {
    dashboardState = {
      filteredTasks: [],
      isLoadingTasks: true,
    };

    render(<ForecastDashboard />);

    expect(screen.getAllByRole('status', { name: 'dashboard.loadingTasks' })).toHaveLength(5);
  });

  it('omits intermediate worker date labels in compact layouts', () => {
    isCompactViewport = true;
    isNarrowViewport = true;

    const { container } = render(<ForecastDashboard />);

    expect(container.querySelector('span[title="2026-06-19"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-20"]')).toBeNull();
    expect(container.querySelector('span[title="2026-06-22"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-25"]')).toBeTruthy();
    expect(container.querySelector('span[title="2026-06-28"]')).toBeTruthy();
  });
});
