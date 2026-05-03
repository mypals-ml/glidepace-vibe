import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDashboard } from '../../context/DashboardContext';
import { AccountSidebar } from './OpenProjectModal/AccountSidebar';
import { ProjectListContent } from './OpenProjectModal/ProjectListContent';
import { IconButton } from '../UI/IconButton';

export function OpenProjectModal() {
  const { isProjectModalOpen } = useDashboard();
  if (!isProjectModalOpen) return null;
  return <OpenProjectModalContent />;
}

function OpenProjectModalContent() {
  const { t } = useTranslation();
  const { setIsProjectModalOpen } = useDashboard();

  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'accounts' | 'projects'>('accounts');
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(sortDropdownRef, () => setIsSortDropdownOpen(false), isSortDropdownOpen);

  const appInstallUrl = (() => {
    let url = import.meta.env.VITE_GITHUB_APP_INSTALL_URL || '#';
    if (url !== '#' && url.includes('github.com/apps/') && !url.includes('/installations/new')) {
      url = url.replace(/\/$/, '') + '/installations/new';
    }
    return url;
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="open-project-title">
      <div className="bg-white/90 backdrop-blur-xl w-full h-full md:h-auto md:max-h-[calc(100vh-48px)] md:max-w-5xl md:rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border-0 md:border md:border-white/40">
        {/* Header */}
        <div className="px-6 md:px-8 py-5 md:py-6 flex justify-between items-center bg-slate-50/40 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {mobileView === 'projects' && (
              <IconButton
                icon="arrow_back"
                variant="ghost"
                size="sm"
                onClick={() => setMobileView('accounts')}
                className="md:hidden"
                aria-label="Back to accounts"
              />
            )}
            <div>
              <h2 id="open-project-title" className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 line-clamp-1">{t('dashboard.openProjectModalTitle')}</h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5 line-clamp-1">{t('dashboard.openProjectModalDesc')}</p>
            </div>
          </div>
          <IconButton
            icon="close"
            variant="ghost"
            size="md"
            onClick={() => setIsProjectModalOpen(false)}
            aria-label="Close"
          />
        </div>
        
        {/* Modal Content */}
        <div className="flex flex-1 min-h-0 md:min-h-[550px]">
          <AccountSidebar 
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            mobileView={mobileView}
            setMobileView={setMobileView}
          />
          
          <div className={`${mobileView === 'projects' ? 'flex' : 'hidden md:flex'} flex-1 w-full md:w-[68%] p-6 md:p-8 bg-white/50 flex-col overflow-y-auto`}>
            <ProjectListContent 
              selectedAccountId={selectedAccountId}
              appInstallUrl={appInstallUrl}
              isSortDropdownOpen={isSortDropdownOpen}
              setIsSortDropdownOpen={setIsSortDropdownOpen}
              sortDropdownRef={sortDropdownRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
