import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

const dashboardMock = vi.hoisted(() => ({
  handleOpenProjectClick: vi.fn(),
  handleConnectDemoAccount: vi.fn(),
}));

vi.mock('../../context/DashboardContext', () => ({
  useDashboard: () => ({
    handleOpenProjectClick: dashboardMock.handleOpenProjectClick,
    handleConnectDemoAccount: dashboardMock.handleConnectDemoAccount,
    isChartVisible: false,
    isLoadingAuth: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('EmptyState', () => {
  it('connects the demo account from the empty project page', () => {
    dashboardMock.handleConnectDemoAccount.mockResolvedValue({ success: true });

    render(<EmptyState />);

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.connectDemoAccountButton' }));

    expect(dashboardMock.handleConnectDemoAccount).toHaveBeenCalledTimes(1);
  });
});
