import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';

const overflowMock = vi.hoisted(() => ({
  isOverflowing: true,
  visibility: {
    'project-selector': true,
    'view-switcher': true,
    settings: true,
    sync: true,
    language: true,
    account: true,
    about: true,
  } as Record<string, boolean>,
}));

const dashboardMock = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../context/DashboardContext', () => ({
  useDashboard: dashboardMock.useDashboard,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../hooks/useLocales', () => ({
  useSortedLocales: () => [{ code: 'en', label: 'EN' }],
}));

vi.mock('@fluentui/react-overflow', () => ({
  useOverflowMenu: () => ({
    ref: vi.fn(),
    isOverflowing: overflowMock.isOverflowing,
  }),
  useIsOverflowItemVisible: (id: string) => overflowMock.visibility[id] ?? true,
}));

describe('HeaderOverflowMenu', () => {
  beforeEach(() => {
    overflowMock.isOverflowing = true;
    overflowMock.visibility = {
      'project-selector': true,
      'view-switcher': true,
      settings: true,
      sync: true,
      language: true,
      account: true,
      about: true,
    };

    dashboardMock.useDashboard.mockReturnValue({
      hasProject: true,
      setIsProjectSettingsModalOpen: vi.fn(),
      lastSyncedTime: Date.now(),
      getSyncedTimeText: () => 'Synced just now',
      selectedProject: null,
      syncProjectNow: vi.fn(),
      refreshProjects: vi.fn(),
      githubToken: 'token',
      dashboardView: 'forecast',
      setDashboardView: vi.fn(),
      isChartVisible: true,
      setIsChartVisible: vi.fn(),
      setIsTaskDetailsOpen: vi.fn(),
      setIsCreateMode: vi.fn(),
      githubAccounts: [],
      isLoadingAuth: false,
      handleOpenAuth: vi.fn(),
      setIsAccountModalOpen: vi.fn(),
      setIsAboutModalOpen: vi.fn(),
      handleOpenProjectClick: vi.fn(),
    });
  });

  it('hides the more actions button when no header items are overflow-hidden', () => {
    const { container } = render(<HeaderOverflowMenu />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).toContain('opacity-0');
  });

  it('shows overflow menu items when a header item is hidden', () => {
    overflowMock.visibility.language = false;

    render(<HeaderOverflowMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
  });
});