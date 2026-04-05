import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';

interface AutoSyncBannerProps {
  appInstallUrl: string;
}

export function AutoSyncBanner({ appInstallUrl }: AutoSyncBannerProps) {
  const { t } = useTranslation();
  const { projectsData, activeTabLogin, isAppInstalled } = useDashboard();

  const activeOwner = projectsData.find(o => o.login === activeTabLogin);
  let targetUrl = appInstallUrl;
  
  if (activeOwner?.databaseId && targetUrl !== '#') {
    const connector = targetUrl.includes('?') ? '&' : '?';
    targetUrl += `${connector}target_id=${activeOwner.databaseId}&suggested_target_id=${activeOwner.databaseId}`;
  }

  const shouldShow = projectsData.length > 0 && !isAppInstalled[activeTabLogin];

  if (!shouldShow) return null;

  return (
    <div className="mb-6 bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-100/50 rounded-lg">
          <span className="material-symbols-outlined text-indigo-600 text-[20px]">sync</span>
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900">{t('dashboard.enableAutoSyncTitle')}</h4>
          <p className="text-xs text-indigo-700/80 mt-0.5 max-w-sm leading-relaxed">
            {t('dashboard.enableAutoSyncDesc')}
          </p>
        </div>
      </div>
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all ml-4"
      >
        <span className="material-symbols-outlined text-[16px]">add_circle</span>
        {t('dashboard.installAppAction')}
      </a>
    </div>
  );
}
