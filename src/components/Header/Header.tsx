import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { ProjectSelectorDropdown } from './ProjectSelectorDropdown';
import { SyncStatusIndicator } from './SyncStatusIndicator';

export function Header() {
  const { t, i18n } = useTranslation();
  const {
    githubAccounts,
    isLoadingAuth,
    handleOpenAuth,
    setIsAccountModalOpen,
    isChartVisible,
    setIsChartVisible,
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

        </div>
      </div>
      <div className="flex items-center gap-[var(--header-gap-sm)] md:gap-[var(--header-gap-md)]">
        {(
        <button
          onClick={() => setIsChartVisible(!isChartVisible)}
          className="flex md:hidden items-center gap-1.5 px-2.5 sm:px-3 h-[var(--header-button-height)] rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm shrink-0"
          aria-label={isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">
            {isChartVisible ? 'format_list_bulleted' : 'show_chart'}
          </span>
          <span className="hidden md:inline whitespace-nowrap">{isChartVisible ? t('dashboard.listToggle') : t('dashboard.chartToggle')}</span>
        </button>
        )}

        <div className="relative flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 lg:hover:bg-white transition-colors rounded-lg lg:rounded-md shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary h-[var(--header-button-height)] w-[var(--header-button-height)] lg:w-auto shrink-0">
          <div className="hidden lg:flex px-3 items-center h-full bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500" id="language-select-label">{t('app.language')}</div>
          <select
            className="absolute inset-0 opacity-0 lg:static lg:opacity-100 border-0 focus:ring-0 text-sm h-full lg:pl-3 lg:pr-8 lg:w-28 text-slate-700 font-medium focus:outline-none bg-transparent appearance-none cursor-pointer z-10"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-labelledby="language-select-label"
            title={t('app.language')}
          >
            <option value="en">{t('app.locales.en')}</option>
            <option value="ja">{t('app.locales.ja')}</option>
            <option value="zh-CN">{t('app.locales.zhCN')}</option>
          </select>
          <span className="material-symbols-outlined absolute lg:right-2 top-1/2 -translate-y-1/2 text-slate-700 lg:text-slate-400 pointer-events-none text-[20px] lg:text-[18px] z-0" aria-hidden="true">language</span>
        </div>

        <SyncStatusIndicator />

        <button
          onClick={githubAccounts.length > 0 ? () => setIsAccountModalOpen(true) : handleOpenAuth}
          disabled={isLoadingAuth}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 h-[var(--header-button-height)] rounded-lg transition-colors text-sm font-medium shadow-sm ${githubAccounts.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'} ${isLoadingAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
        >
          {isLoadingAuth ? (
            <svg aria-hidden="true" className="w-4 h-4 fill-current animate-spin" viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"></path></svg>
          ) : (
            <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd"></path></svg>
          )}
          <span className="hidden lg:inline whitespace-nowrap truncate max-w-[120px]">
            {githubAccounts.length > 0 ? t('app.connectedAccounts') : t('app.connectToGitHub')}
          </span>
        </button>
      </div>
    </header>
  );
}
