import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

const dashboardMock = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../context/DashboardContext', () => ({
  useDashboard: dashboardMock.useDashboard,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@fluentui/react-overflow', () => ({
  Overflow: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OverflowItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./ProjectSelectorDropdown', () => ({
  ProjectSelectorDropdown: () => <div>Project Selector</div>,
}));

vi.mock('./LanguageSelectorDropdown', () => ({
  LanguageSelectorDropdown: () => <div>Language Selector</div>,
}));

vi.mock('./SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <div>Sync Indicator</div>,
}));

vi.mock('../Dashboard/Views/DashboardViewSwitcher', () => ({
  DashboardViewSwitcher: () => <div>View Switcher</div>,
}));

vi.mock('./HeaderOverflowMenu', () => ({
  HeaderOverflowMenu: () => <div>Overflow Menu</div>,
}));

describe('Header', () => {
  const setIsAboutModalOpen = vi.fn();

  beforeEach(() => {
    setIsAboutModalOpen.mockReset();
    dashboardMock.useDashboard.mockReturnValue({
      githubAccounts: [{ id: '1', login: 'willwhui' }],
      isLoadingAuth: false,
      handleOpenAuth: vi.fn(),
      setIsAccountModalOpen: vi.fn(),
      setIsAboutModalOpen,
      hasProject: true,
      setIsProjectSettingsModalOpen: vi.fn(),
    });
  });

  it('opens the about modal when the about button is clicked', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'About' }));

    expect(setIsAboutModalOpen).toHaveBeenCalledWith(true);
  });

  it('shows G as the compact mobile app mark', () => {
    render(<Header />);

    expect(screen.getByText('G')).toBeTruthy();
    expect(screen.queryByText('GL')).toBeNull();
    expect(screen.queryByText('GP')).toBeNull();
  });

  it('keeps fixed spacing around the mobile app mark divider when header compresses', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    header?.classList.add('header-compressed');

    const divider = container.querySelector('.h-6.w-px.bg-slate-200');
    expect(divider).toBeTruthy();
    expect(divider?.classList.contains('hidden')).toBe(false);
    expect((divider as HTMLElement).style.marginLeft).toBe('var(--header-divider-gap)');
    expect((divider as HTMLElement).style.marginRight).toBe('var(--header-divider-gap)');
  });
});
