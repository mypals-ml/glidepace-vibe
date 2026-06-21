import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusIndicator } from './SyncStatusIndicator';

const dashboardMock = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../context/DashboardContext', () => ({
  useDashboard: dashboardMock.useDashboard,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? 'Sync Now',
  }),
}));

vi.mock('@fluentui/react-overflow', () => ({
  OverflowItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SyncStatusIndicator', () => {
  const syncProjectNow = vi.fn();
  const refreshProjects = vi.fn();

  beforeEach(() => {
    syncProjectNow.mockReset();
    refreshProjects.mockReset();
    dashboardMock.useDashboard.mockReturnValue({
      lastSyncedTime: 0,
      getSyncedTimeText: () => '',
      selectedProject: { id: 'project-1' },
      syncProjectNow,
      refreshProjects,
    });
  });

  it('renders the sync action without a permanent green status dot', () => {
    const { container } = render(<SyncStatusIndicator />);

    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeTruthy();
    expect(container.querySelector('.bg-emerald-500')).toBeNull();
    expect(container.querySelector('.bg-emerald-400')).toBeNull();
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('refreshes the selected project when clicked', () => {
    render(<SyncStatusIndicator />);

    fireEvent.click(screen.getByRole('button', { name: 'Sync Now' }));

    expect(syncProjectNow).toHaveBeenCalledTimes(1);
    expect(refreshProjects).not.toHaveBeenCalled();
  });
});
