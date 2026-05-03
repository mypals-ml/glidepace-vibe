import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { Button } from '../../UI/Button';
import { IconButton } from '../../UI/IconButton';

interface AccountSidebarProps {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  mobileView: 'accounts' | 'projects';
  setMobileView: (view: 'accounts' | 'projects') => void;
}

export function AccountSidebar({ 
  selectedAccountId, 
  setSelectedAccountId, 
  mobileView, 
  setMobileView 
}: AccountSidebarProps) {
  const { t } = useTranslation();
  const { 
    githubAccounts, 
    setActiveAccountId, 
    fetchProjects, 
    isRefreshing, 
    setIsAccountModalOpen 
  } = useDashboard();

  return (
    <div className={`${mobileView === 'accounts' ? 'flex' : 'hidden md:flex'} w-full md:w-[32%] bg-slate-50/50 p-6 md:p-8 border-r border-slate-200 flex-col overflow-y-auto`}>
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 md:mb-8">{t('app.connectedAccountsLabel')}</h3>
      <div className="space-y-4 flex-1">
        {githubAccounts.map((account) => (
          <div
            key={account.id}
            onClick={() => {
              setSelectedAccountId(account.id);
              setActiveAccountId(account.id);
              fetchProjects(account.token, account.id, false);
              setMobileView('projects');
            }}
            className={`relative flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${selectedAccountId === account.id ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-200' : 'hover:bg-slate-100/60'}`}
          >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-200">
              <img alt={account.login} className="w-full h-full object-cover" src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <p className={`text-sm font-bold truncate transition-colors ${selectedAccountId === account.id ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>@{account.login}</p>
              <p className="text-[11px] font-bold tracking-tight mt-0.5 text-slate-400">{t('app.connected')}</p>
            </div>
            <IconButton
              icon="refresh"
              variant="ghost"
              size="sm"
              isLoading={isRefreshing[account.id]}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAccountId(account.id);
                fetchProjects(account.token, account.id, false);
              }}
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${
                isRefreshing[account.id] 
                  ? 'opacity-100' 
                  : (selectedAccountId === account.id ? 'opacity-0 group-hover:opacity-100' : 'hidden')
              } transition-opacity bg-white/80 backdrop-blur shadow-sm`}
              title={t('dashboard.refreshProjects')}
              aria-label={t('dashboard.refreshProjects')}
            />
          </div>
        ))}
      </div>
      {/* Manage Button */}
      <Button
        variant="secondary"
        size="md"
        fullWidth
        onClick={() => setIsAccountModalOpen(true)}
        leftIcon="settings"
        className="mt-6 md:mt-8 bg-slate-100/50 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
      >
        {t('dashboard.manageButton')}
      </Button>
    </div>
  );
}
