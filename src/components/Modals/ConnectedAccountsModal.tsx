import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';

export function ConnectedAccountsModal() {
  const { t } = useTranslation();
  const {
    githubAccounts,
    selectedProject,
    isAccountModalOpen,
    setIsAccountModalOpen,
    setIsPatModalOpen,
    handleOpenAuth,
    handleDisconnect,
    authError,
    setAuthError,
  } = useDashboard();

  if (isAccountModalOpen) {
    console.log('[Auth] ConnectedAccountsModal is OPEN');
  }

  if (!isAccountModalOpen) return null;

  const handleClose = () => {
    setIsAccountModalOpen(false);
    setAuthError(null);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="manage-accounts-title">
      <div className="relative bg-white/70 backdrop-blur-xl border border-white w-full max-w-md rounded-xl shadow-[0_12px_40px_rgba(25,28,30,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 id="manage-accounts-title" className="font-sans text-2xl font-extrabold text-slate-900">{t('app.connectedAccounts')}</h3>
            <IconButton
              icon="close"
              variant="ghost"
              size="md"
              onClick={handleClose}
              aria-label="Close"
            />
          </div>
          <p className="text-slate-500 text-sm">{t('app.manageAccounts')}</p>
        </div>
        {/* Modal Content (Account List) */}
        <div className="p-8 space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
          {githubAccounts.map((account) => (
            <div key={account.id} className={`flex items-center justify-between bg-white/50 p-4 rounded-xl border transition-all ${selectedProject?.accountId === account.id ? 'border-primary ring-1 ring-primary' : 'border-white/40'}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-primary/20">
                  <img className="w-full h-full object-cover" alt={account.login} src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
                </div>
                <div>
                  <p className="font-sans font-bold text-slate-900 leading-tight flex items-center gap-2">
                    {account.name || account.login}
                  </p>
                  <p className="text-xs text-slate-500">@{account.login}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={(e) => { e.stopPropagation(); handleDisconnect(account.id); }}
              >
                {t('app.disconnect')}
              </Button>
            </div>
          ))}
        </div>
        {/* Modal Footer (Action) */}
        <div className="p-8 pt-2">
          {authError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 animate-in slide-in-from-bottom-2 duration-300">
               <span className="material-symbols-outlined text-amber-500 shrink-0">warning</span>
               <div className="space-y-2">
                 <p className="text-xs text-amber-800 font-medium leading-relaxed">{authError}</p>
                 <a 
                   href="https://github.com/logout" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="inline-block text-[10px] font-bold text-amber-700 hover:underline uppercase tracking-wider"
                 >
                   Sign out of GitHub.com
                 </a>
               </div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              console.log('[Auth] Clicked "Connect to Add" (OAuth flow)');
              handleOpenAuth();
            }}
            leftIcon="add_circle"
            className="rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-primary/20"
          >
            {t('app.connectToAdd')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            className="mt-3"
            onClick={() => {
              console.log('[Auth] Clicked "Add manually with token" (PAT flow)');
              setIsPatModalOpen(true);
              setAuthError(null);
            }}
          >
            {t('app.addManuallyWithToken')}
          </Button>
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-500 leading-relaxed italic text-center">
              <span className="material-symbols-outlined text-[12px] align-middle mr-1">info</span>
              {t('app.oauthSessionTip')}
            </p>
          </div>
          <p className="text-center mt-4 text-[10px] text-slate-400 px-6 uppercase tracking-widest">
            {t('app.addAccountPermissionNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
