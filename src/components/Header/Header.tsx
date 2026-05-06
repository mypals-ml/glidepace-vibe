import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { IconButton } from '../UI/IconButton';
import { ProjectSelectorDropdown } from './ProjectSelectorDropdown';
import { LanguageSelectorDropdown } from './LanguageSelectorDropdown';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { Button } from '../UI/Button';

export function Header() {
  const { t } = useTranslation();
  const {
    githubAccounts,
    isLoadingAuth,
    handleOpenAuth,
    setIsAccountModalOpen,
    isChartVisible,
    setIsChartVisible,
    hasProject,
    setIsProjectSettingsModalOpen,
  } = useDashboard();

  return (
    <header className="glass-panel border-b border-surface-border px-6 py-3 flex items-center justify-between z-20 sticky top-0 bg-white/70 shadow-sm gap-[var(--header-gap-md)]">
      <div className="flex items-center gap-[var(--header-gap-lg)]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            <a href="https://github.com/mypals-ml/glidepace-vibe" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('app.name')}
            </a>
          </h1>
        </div>
        <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>
        <div className="flex items-center gap-[var(--header-gap-sm)] md:gap-[var(--header-gap-md)]">
          <ProjectSelectorDropdown />
          {hasProject && (
            <IconButton
              icon="settings"
              variant="ghost"
              size="sm"
              onClick={() => setIsProjectSettingsModalOpen(true)}
              title={t('settings.projectSettings', 'Project Settings')}
              aria-label={t('settings.projectSettings', 'Project Settings')}
              className="text-slate-400 hover:text-primary hover:bg-primary/5"
            />
          )}

        </div>
      </div>
      <div className="flex items-center gap-[var(--header-gap-sm)] md:gap-[var(--header-gap-md)]">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsChartVisible(!isChartVisible)}
          className="w-[var(--btn-h-sm)] sm:w-auto px-0 sm:px-[var(--btn-px-sm)] md:hidden justify-center"
          leftIcon={isChartVisible ? 'format_list_bulleted' : 'show_chart'}
          aria-label={isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}
        >
          <span className="hidden sm:inline">
            {isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}
          </span>
        </Button>

        <LanguageSelectorDropdown />

        <SyncStatusIndicator />

        <Button
          variant={githubAccounts.length > 0 ? 'success' : 'primary'}
          size="sm"
          onClick={githubAccounts.length > 0 ? () => setIsAccountModalOpen(true) : handleOpenAuth}
          disabled={isLoadingAuth}
          isLoading={isLoadingAuth}
          aria-label={githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
          className="w-[var(--btn-h-sm)] lg:w-44 px-0 lg:px-[var(--btn-px-sm)] justify-center"
        >
          <div className="flex items-center gap-2">
            {!isLoadingAuth && (
              <svg aria-hidden="true" className="w-5 h-5 lg:w-4 lg:h-4 fill-current" viewBox="0 0 24 24">
                <path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path>
              </svg>
            )}
            <span className="hidden lg:inline whitespace-nowrap truncate max-w-[120px]">
              {githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
            </span>
          </div>
        </Button>
      </div>
    </header>
  );
}
