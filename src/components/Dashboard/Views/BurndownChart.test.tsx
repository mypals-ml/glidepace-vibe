import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurndownChart } from './BurndownChart';
import type { Task } from '../../../types';

const tasks: Task[] = [
  {
    kind: 'task',
    id: 'task-1',
    itemId: 'item-1',
    displayId: '#1',
    title: 'Task 1',
    status: 'Todo',
    startDate: '2026-05-05',
    targetDate: '2026-05-08',
    assignees: [],
    progress: 0,
    estimate: 4,
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

describe('BurndownChart loading state', () => {
  it('shows section loading indicators while tasks are loading', () => {
    dashboardState = {
      filteredTasks: [],
      isLoadingTasks: true,
    };

    render(<BurndownChart />);

    expect(screen.getAllByRole('status', { name: 'dashboard.loadingTasks' })).toHaveLength(4);
  });
});
