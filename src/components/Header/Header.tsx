import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { IconButton } from '../UI/IconButton';
import { ProjectSelectorDropdown } from './ProjectSelectorDropdown';
import { LanguageSelectorDropdown } from './LanguageSelectorDropdown';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { DashboardViewSwitcher } from '../Dashboard/Views/DashboardViewSwitcher';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { Button } from '../UI/Button';
import { Overflow, OverflowItem } from '@fluentui/react-overflow';
import { UI_LAYER } from '../../lib/uiLayering';

/**
 * Priority+ responsive header.
 *
 * Spacing Strategy:
 * 1. Gaps are managed via `--header-gap` CSS variable.
 * 2. Gap spacing is moved INSIDE the OverflowItem (using margin-right).
 *    This allows the Overflow manager to measure the "item + gap" as a single unit.
 * 3. Only the Account button (or the More menu if account is hidden) uses
 *    `margin-left: auto`, creating the flexible space in the middle.
 */
export function Header() {
  const { t } = useTranslation();
  const {
    githubAccounts,
    isLoadingAuth,
    handleOpenAuth,
    setIsAccountModalOpen,
    setIsAboutModalOpen,
    hasProject,
    setIsProjectSettingsModalOpen,
  } = useDashboard();

  const [hasOverflow, setHasOverflow] = useState(false);
  
  return (
    <header className={`glass-panel border-b border-surface-border ${UI_LAYER.header} sticky top-0 bg-white/70 shadow-sm px-4 md:px-6 py-3 transition-all duration-300 ${hasOverflow ? 'header-compressed' : ''}`}>
      <div className="flex items-center">
        {/* ── Fixed left ── */}
        <div className="flex items-center shrink-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
            <a href="https://github.com/mypals-ml/glidepace-vibe" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors no-underline text-inherit">
              <span className="hidden xs:inline">{t('app.name')}</span>
              <span className="xs:hidden">G</span>
            </a>
          </h1>
        </div>
        
        <div
          className="h-6 w-px shrink-0 bg-slate-200"
          style={{ marginLeft: 'var(--header-divider-gap)', marginRight: 'var(--header-divider-gap)' }}
        ></div>

        {/* ── Overflow zone ── */}
        <Overflow padding={4} onOverflowChange={(_, data) => setHasOverflow(data.hasOverflow)}>
          <div className="flex items-center flex-1 min-w-0">
            <OverflowItem id="project-selector" priority={1000}>
              <div className="shrink-0 min-w-max" style={{ marginRight: 'var(--header-gap)' }}>
                <ProjectSelectorDropdown />
              </div>
            </OverflowItem>

            {hasProject && (
              <>
                <OverflowItem id="settings" priority={700}>
                  <div style={{ marginRight: 'var(--header-gap)' }}>
                    <IconButton
                      icon="settings"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsProjectSettingsModalOpen(true)}
                      title={t('settings.projectSettings', 'Project Settings')}
                      aria-label={t('settings.projectSettings', 'Project Settings')}
                      className="text-slate-400 hover:text-primary hover:bg-primary/5"
                    />
                  </div>
                </OverflowItem>

                <OverflowItem id="view-switcher" priority={800}>
                  <div style={{ marginRight: 'var(--header-gap)' }}>
                    <DashboardViewSwitcher />
                  </div>
                </OverflowItem>
              </>
            )}
            
            <OverflowItem id="language" priority={500}>
              <div style={{ marginRight: 'var(--header-gap)' }}>
                <LanguageSelectorDropdown />
              </div>
            </OverflowItem>

            <OverflowItem id="sync" priority={600}>
              <div style={{ marginRight: 'var(--header-gap)' }}>
                <SyncStatusIndicator />
              </div>
            </OverflowItem>

            {/* Spacer to push remaining items to the right */}
            <div style={{ flexGrow: 1 }} />

            <OverflowItem id="account" priority={900}>
              <div style={{ marginRight: 'var(--header-gap)' }}>
                <Button
                  variant={githubAccounts.length > 0 ? 'success' : 'primary'}
                  size="sm"
                  onClick={githubAccounts.length > 0 ? () => setIsAccountModalOpen(true) : handleOpenAuth}
                  disabled={isLoadingAuth}
                  isLoading={isLoadingAuth}
                  aria-label={githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
                  className="px-[var(--btn-px-sm)] justify-center"
                >
                  <div className="flex items-center gap-2">
                    {!isLoadingAuth && (
                      <svg aria-hidden="true" className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                        <path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path>
                      </svg>
                    )}
                    <OverflowItem id="account-text" priority={50}>
                      <span className="whitespace-nowrap truncate max-w-[120px]">
                        {githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
                      </span>
                    </OverflowItem>
                  </div>
                </Button>
              </div>
            </OverflowItem>

            <OverflowItem id="about" priority={100}>
              <div style={{ marginRight: 'var(--header-gap)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="info"
                  onClick={() => setIsAboutModalOpen(true)}
                  aria-label={t('about.button', 'About')}
                  className="text-slate-600 hover:bg-sky-50 hover:text-sky-700"
                >
                  {t('about.button', 'About')}
                </Button>
              </div>
            </OverflowItem>
            
            <HeaderOverflowMenu />
          </div>
        </Overflow>
      </div>
    </header>
  );
}
