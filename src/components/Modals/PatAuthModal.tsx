import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { Button } from '../UI/Button';

export function PatAuthModal() {
  const { isPatModalOpen } = useDashboard();
  if (!isPatModalOpen) return null;
  return <PatAuthModalContent />;
}

function PatAuthModalContent() {
  const { t } = useTranslation();
  const {
    setIsPatModalOpen,
    handleAddAccountByToken,
    isLoadingAuth,
  } = useDashboard();

  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, () => !isLoadingAuth && setIsPatModalOpen(false), true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    
    setError(null);
    const result = await handleAddAccountByToken(token.trim());
    if (!result.success) {
      setError(result.error || 'An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500"
      >
        {/* Subtle top organic shape blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-indigo-500/10 blur-[60px] pointer-events-none rounded-full"></div>
        
        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
            <span className="material-symbols-outlined text-white text-3xl">vpn_key</span>
          </div>

          <h3 id="auth-modal-title" className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            {t('app.authTitle')}
          </h3>
          <p className="text-sm font-medium text-slate-500 max-w-[280px] leading-relaxed mb-8">
            {t('app.authDesc')}
          </p>

          <form onSubmit={handleSave} className="w-full space-y-6">
            <div className="relative group">
              <input
                type="password"
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('app.authInputPlaceholder')}
                disabled={isLoadingAuth}
                className={`w-full px-5 py-4 bg-slate-100/50 border-2 rounded-xl text-sm font-bold transition-all outline-none 
                  ${error ? 'border-rose-200 focus:border-rose-400 text-rose-900' : 'border-transparent focus:border-indigo-400 focus:bg-white text-slate-900'}
                  group-hover:bg-slate-100 placeholder:text-slate-400`}
              />
              {error && (
                <div className="mt-2 flex items-center gap-1.5 px-1 animate-in slide-in-from-top-1">
                  <span className="material-symbols-outlined text-rose-500 text-sm">error</span>
                  <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">{error}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isLoadingAuth || !token.trim()}
                isLoading={isLoadingAuth}
                rightIcon="arrow_forward"
                className="bg-slate-900 hover:bg-slate-800"
              >
                {t('app.authSave')}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setIsPatModalOpen(false)}
                disabled={isLoadingAuth}
              >
                {t('app.authCancel')}
              </Button>
            </div>
          </form>
        </div>
        
        {/* Footer info line */}
        <div className="bg-slate-50/50 border-t border-slate-100 p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[12px]">security</span>
            End-to-end local storage encryption
          </p>
        </div>
      </div>
    </div>
  );
}
