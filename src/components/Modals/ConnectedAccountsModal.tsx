import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';

export function ConnectedAccountsModal() {
  const { t } = useTranslation();
  const {
    githubAccounts,
    activeAccountId,
    setActiveAccountId,
    isAccountModalOpen,
    setIsAccountModalOpen,
    handleOpenAuth,
    handleDisconnect,
  } = useDashboard();

  if (!isAccountModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 lg:p-8" role="dialog" aria-modal="true" aria-labelledby="manage-accounts-title">
      <div className="relative bg-white/70 backdrop-blur-xl border border-white w-full max-w-md rounded-xl shadow-[0_12px_40px_rgba(25,28,30,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 id="manage-accounts-title" className="font-sans text-2xl font-extrabold text-slate-900">{t('app.connectedAccounts')}</h3>
            <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors" aria-label="Close">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          <p className="text-slate-500 text-sm">{t('app.manageAccounts')}</p>
        </div>
        {/* Modal Content (Account List) */}
        <div className="p-8 space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
          {githubAccounts.map((account) => (
            <div key={account.id} onClick={() => setActiveAccountId(account.id)} className={`flex items-center justify-between bg-white/50 p-4 rounded-xl border transition-all cursor-pointer ${activeAccountId === account.id ? 'border-primary ring-1 ring-primary' : 'border-white/40 hover:border-primary/50'}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-primary/20">
                  <img className="w-full h-full object-cover" alt={account.login} src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.login}`} />
                </div>
                <div>
                  <p className="font-sans font-bold text-slate-900 leading-tight flex items-center gap-2">
                    {account.name || account.login}
                    {activeAccountId === account.id && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">{t('app.activeStatus')}</span>}
                  </p>
                  <p className="text-xs text-slate-500">@{account.login}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDisconnect(account.id); }} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-all">
                {t('app.disconnect')}
              </button>
            </div>
          ))}
        </div>
        {/* Modal Footer (Action) */}
        <div className="p-8 pt-2">
          <button onClick={handleOpenAuth} className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-sans font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">add_circle</span>
            {t('app.connectToAdd')}
          </button>
          <p className="text-center mt-4 text-xs text-slate-500 px-6">
            {t('app.addAccountPermissionNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
