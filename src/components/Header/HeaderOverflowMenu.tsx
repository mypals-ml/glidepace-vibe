import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useSortedLocales } from '../../hooks/useLocales';
import { changeUiLanguage } from '../../lib/uiLocaleStorage';
import { UI_LAYER } from '../../lib/uiLayering';
import { getProjectDisplayTitle } from '../../lib/projectDisplay';
import { IconButton } from '../UI/IconButton';
import { ForecastIcon } from '../Dashboard/Views/ForecastIcon';
import { useOverflowMenu, useIsOverflowItemVisible, useOverflowContext } from '@fluentui/react-overflow';
import { hasHeaderOverflowMenuItems } from '../../lib/headerOverflowMenu';

const HEADER_OVERFLOW_ITEM_IDS = [
  'project-selector',
  'view-switcher',
  'settings',
  'sync',
  'language',
  'account',
  'about',
] as const;

type HeaderOverflowItemId = typeof HEADER_OVERFLOW_ITEM_IDS[number];
type ClippedHeaderItems = Partial<Record<HeaderOverflowItemId, boolean>>;

/**
 * Overflow "More" menu that dynamically shows hidden header items.
 *
 * Uses @fluentui/react-overflow hooks:
 * - useOverflowMenu: registers the menu button so the overflow manager
 *   accounts for its width when deciding what to hide.
 * - useIsOverflowItemVisible: checks each item's visibility to decide
 *   what to render in the dropdown.
 */
export function HeaderOverflowMenu() {
  const { t, i18n } = useTranslation();
  const { 
    setIsProjectSettingsModalOpen, 
    lastSyncedTime, 
    getSyncedTimeText,
    selectedProject,
    syncProjectNow,
    refreshProjects,
    dashboardView,
    setDashboardView,
    isChartVisible,
    setIsChartVisible,
    setIsTaskDetailsOpen,
    setIsCreateMode,
    githubAccounts,
    isLoadingAuth,
    handleOpenAuth,
    setIsAccountModalOpen,
    setIsAboutModalOpen,
    handleOpenProjectClick,
    hasProject,
  } = useDashboard();
  
  const [isOpen, setIsOpen] = useState(false);
  const [clippedItems, setClippedItems] = useState<ClippedHeaderItems>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sortedLocales = useSortedLocales();

  // Register with overflow manager
  const { ref: overflowMenuRef } = useOverflowMenu<HTMLButtonElement>();
  const updateOverflow = useOverflowContext(ctx => ctx.updateOverflow);

  // Check visibility of each item
  const isProjectSelectorVisible = useIsOverflowItemVisible('project-selector');
  const isViewSwitcherVisible = useIsOverflowItemVisible('view-switcher');
  const isSettingsVisible = useIsOverflowItemVisible('settings');
  const isSyncVisible = useIsOverflowItemVisible('sync');
  const isLanguageVisible = useIsOverflowItemVisible('language');
  const isAccountVisible = useIsOverflowItemVisible('account');
  const isAboutVisible = useIsOverflowItemVisible('about');
  const isProjectSelectorOverflowed = !isProjectSelectorVisible || !!clippedItems['project-selector'];
  const isViewSwitcherOverflowed = hasProject && (!isViewSwitcherVisible || !!clippedItems['view-switcher']);
  const isSettingsOverflowed = hasProject && (!isSettingsVisible || !!clippedItems.settings);
  const isSyncOverflowed = !isSyncVisible || !!clippedItems.sync;
  const isLanguageOverflowed = !isLanguageVisible || !!clippedItems.language;
  const isAccountOverflowed = !isAccountVisible || !!clippedItems.account;
  const isAboutOverflowed = !isAboutVisible || !!clippedItems.about;
  const selectedProjectDisplayTitle = getProjectDisplayTitle(selectedProject?.title, t('dashboard.currentProject', 'Current Project'));
  const shouldShowOverflowMenu = hasHeaderOverflowMenuItems({
    hasProject,
    isProjectSelectorVisible: !isProjectSelectorOverflowed,
    isViewSwitcherVisible: !isViewSwitcherOverflowed,
    isSettingsVisible: !isSettingsOverflowed,
    isSyncVisible: !isSyncOverflowed,
    isLanguageVisible: !isLanguageOverflowed,
    isAccountVisible: !isAccountOverflowed,
    isAboutVisible: !isAboutOverflowed,
  });

  const moreWrapperClass = `relative shrink-0 transition-[opacity,width] ${shouldShowOverflowMenu ? 'w-[var(--header-button-height)] opacity-100 overflow-visible' : 'w-0 opacity-0 pointer-events-none overflow-hidden'}`;

  useEffect(() => {
    let frameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let lateTimer: number | null = null;

    const getContainer = (): HTMLElement | null => {
      let c = dropdownRef.current?.closest('.fui-Overflow') as HTMLElement | null;
      if (!c) c = document.querySelector('.fui-Overflow') as HTMLElement | null; // fallback, matches the ping/dump queries
      return c;
    };

    const updateClippedItems = () => {
      const overflowContainer = getContainer();
      if (!(overflowContainer instanceof HTMLElement)) {
        return;
      }

      const containerRect = overflowContainer.getBoundingClientRect();
      const SIM_PADDING = 4;

      const nextClippedItems: ClippedHeaderItems = {};

      HEADER_OVERFLOW_ITEM_IDS.forEach((id) => {
        const item = overflowContainer.querySelector<HTMLElement>(`[data-header-overflow-id="${id}"]`);
        if (!item) {
          nextClippedItems[id] = false;
          return;
        }

        const itemRect = item.getBoundingClientRect();
        const over = itemRect.right - (containerRect.right - SIM_PADDING);
        const isClipped = itemRect.width > 0 && over > 1;
        nextClippedItems[id] = isClipped;

        // Geometry fallback: force the data-overflowing attr so CSS hides the item
        // when our clip calc says it doesn't fit. This keeps the visual consistent
        // even if the @fluentui manager disagrees on exact measurements.
        if (isClipped) {
          item.setAttribute('data-overflowing', '');
        }
        // (do not blindly remove here; lib will clear attrs itself when its measurements say the item fits again)
      });

      setClippedItems((currentClippedItems) => {
        const didChange = HEADER_OVERFLOW_ITEM_IDS.some(
          (id) => !!currentClippedItems[id] !== !!nextClippedItems[id],
        );
        return didChange ? nextClippedItems : currentClippedItems;
      });
    };

    const requestClippedItemUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        updateClippedItems();
        frameId = null;
      });
    };

    // Always schedule initial check; lookup happens inside update
    requestClippedItemUpdate();

    window.addEventListener('resize', requestClippedItemUpdate);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(requestClippedItemUpdate);
      // Observe the menu wrapper itself
      if (dropdownRef.current) {
        resizeObserver.observe(dropdownRef.current);
      }
      // Observe the overflow root if already findable
      const initial = getContainer();
      if (initial) {
        resizeObserver.observe(initial);
      }
      // Late attach in case DOM/class timing on first mount
      lateTimer = window.setTimeout(() => {
        const c = getContainer();
        if (c && resizeObserver) {
          try {
            resizeObserver.observe(c);
          } catch {
            // ignore if already observed or element issues
          }
        }
      }, 0);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (lateTimer !== null) {
        window.clearTimeout(lateTimer);
      }
      window.removeEventListener('resize', requestClippedItemUpdate);
      resizeObserver?.disconnect();
    };
  }, []);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  // When our clipped fallback decides something needs the menu (or visibility changes),
  // ask the manager to re-evaluate. This helps settle borderline cases where
  // margin gaps vs offsetWidth measurements + More button size cause the
  // last item (About) to appear clipped to geometry but still "visible" to the lib.
  useEffect(() => {
    if (shouldShowOverflowMenu) {
      // Use RAF so the width/opacity classes have applied and layout updated.
      const id = window.requestAnimationFrame(() => updateOverflow?.());
      return () => window.cancelAnimationFrame(id);
    }
  }, [shouldShowOverflowMenu, updateOverflow]);

  const handleSync = () => {
    if (selectedProject?.id) {
      void syncProjectNow();
    } else {
      refreshProjects();
    }
    setIsOpen(false);
  };

  const handleSwitch = (view: 'list' | 'gantt' | 'forecast') => {
    if (view === 'list') {
      setIsChartVisible(false);
    } else {
      setIsChartVisible(true);
      if (view === 'forecast') {
        // Dismiss task details (and create) when switching to Forecast Dashboard.
        // Addresses: if details view showing, click Forecast button should dismiss it.
        setIsTaskDetailsOpen(false);
        setIsCreateMode(false);
      }
      setDashboardView(view);
    }
    setIsOpen(false);
  };

  const currentTab = !isChartVisible ? 'list' : dashboardView;

  return (
    <div className={moreWrapperClass} ref={dropdownRef}>
      <IconButton
        ref={overflowMenuRef}
        icon="more_vert"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-slate-500 hover:bg-slate-100 ${isOpen ? 'bg-slate-100 text-primary' : ''}`}
        title={t('app.moreOptions', 'More options')}
        aria-label={t('app.moreOptions', 'More options')}
        aria-expanded={isOpen}
      />

      {isOpen && shouldShowOverflowMenu && (
        <div className={`fixed right-4 top-[var(--app-header-height)] mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] ${UI_LAYER.headerDropdown} overflow-hidden border border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-150`}>
          <div className="p-1.5 flex flex-col gap-1">
            
            {/* View Switcher Section */}
            {isViewSwitcherOverflowed && (
              <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('dashboard.view', 'View')}
                </div>
                <div className="flex flex-col gap-0.5 px-1 pb-2">
                  <button
                    onClick={() => handleSwitch('list')}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'list' ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                      <span>{t('dashboard.viewList', 'List')}</span>
                    </div>
                    {currentTab === 'list' && <span className="material-symbols-outlined text-sm">check</span>}
                  </button>
                  <button
                    onClick={() => handleSwitch('gantt')}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'gantt' ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]" style={{ transform: 'scaleX(-1)' }}>view_timeline</span>
                      <span>{t('dashboard.viewGantt', 'Gantt')}</span>
                    </div>
                    {currentTab === 'gantt' && <span className="material-symbols-outlined text-sm">check</span>}
                  </button>
                  <button
                    onClick={() => handleSwitch('forecast')}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'forecast' ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <ForecastIcon size={20} />
                      <span>{t('dashboard.viewForecast', 'Forecast')}</span>
                    </div>
                    {currentTab === 'forecast' && <span className="material-symbols-outlined text-sm">check</span>}
                  </button>
                </div>
                {(isSettingsOverflowed || isSyncOverflowed || isAccountOverflowed || isLanguageOverflowed || isProjectSelectorOverflowed) && <div className="h-px bg-slate-100 my-1 mx-2" />}
              </>
            )}

            {/* Actions Section */}
            {(isSettingsOverflowed || isSyncOverflowed || isAccountOverflowed || isAboutOverflowed || isProjectSelectorOverflowed) && (
              <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('app.actions', 'Actions')}
                </div>

                {/* Project Selector (when fully hidden) */}
                {isProjectSelectorOverflowed && (
                  <button
                    onClick={() => {
                      // This is a bit tricky since the dropdown is hidden.
                      // We can just trigger the project modal directly.
                      handleOpenProjectClick();
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-400">folder_open</span>
                    <div className="flex flex-col items-start leading-none min-w-0">
                      <span className="truncate w-full text-left">{t('dashboard.addProjectButton', 'Open Project')}</span>
                      {selectedProject && (
                        <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-left">{selectedProjectDisplayTitle}</span>
                      )}
                    </div>
                  </button>
                )}

                {/* Project Settings */}
                {isSettingsOverflowed && (
                  <button
                    onClick={() => {
                      setIsProjectSettingsModalOpen(true);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-400">settings</span>
                    <span>{t('settings.projectSettings', 'Project Settings')}</span>
                  </button>
                )}

                {/* Sync Now */}
                {isSyncOverflowed && (
                  <button
                    onClick={handleSync}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-slate-400">sync</span>
                    </div>
                    <div className="flex flex-col items-start leading-none min-w-0">
                      <span className="truncate w-full text-left">{t('app.syncNow', 'Sync Now')}</span>
                      <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-left">{getSyncedTimeText(lastSyncedTime)}</span>
                    </div>
                  </button>
                )}

                {/* Account Button */}
                {isAccountOverflowed && (
                  <button
                    onClick={() => {
                      if (githubAccounts.length > 0) {
                        setIsAccountModalOpen(true);
                      } else {
                        handleOpenAuth();
                      }
                      setIsOpen(false);
                    }}
                    disabled={isLoadingAuth}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {isLoadingAuth ? (
                      <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="w-5 h-5 fill-current text-slate-400" viewBox="0 0 24 24">
                        <path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path>
                      </svg>
                    )}
                    <span>{githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}</span>
                  </button>
                )}

                {isAboutOverflowed && (
                  <button
                    onClick={() => {
                      setIsAboutModalOpen(true);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-400">info</span>
                    <span>{t('about.button', 'About')}</span>
                  </button>
                )}
                {isLanguageOverflowed && <div className="h-px bg-slate-100 my-1 mx-2" />}
              </>
            )}

            {/* Language Selection */}
            {isLanguageOverflowed && (
              <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('app.language', 'Language')}
                </div>
                <div className="flex flex-col gap-0.5 px-1">
                  {sortedLocales.map((locale) => (
                    <button
                      key={locale.code}
                      onClick={() => {
                        changeUiLanguage(i18n, locale.code);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        i18n.language === locale.code 
                          ? 'bg-primary/5 text-primary' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{locale.label}</span>
                      {i18n.language === locale.code && (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
