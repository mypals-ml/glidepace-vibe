import { useTranslation } from 'react-i18next';

export function HelpOrgProjects() {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-8 md:p-12 border-t-4 border-primary relative">
      {/* Language switch (moved outside the central card) */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <div className="relative flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
          <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500" id="help-language-select-label">{t('app.language')}</div>
          <select 
            className="border-0 focus:ring-0 text-sm py-1.5 pl-3 pr-8 w-28 text-slate-700 font-medium focus:outline-none bg-transparent appearance-none cursor-pointer"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-labelledby="help-language-select-label"
          >
            <option value="en">{t('app.locales.en')}</option>
            <option value="ja">{t('app.locales.ja')}</option>
            <option value="zh-CN">{t('app.locales.zhCN')}</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]" aria-hidden="true">language</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-8 md:mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 bg-white px-8 py-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('help.orgProjectsTitle')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('help.orgProjectsIntro')}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-10">
          
          <section>
            <div className="flex items-center gap-3 mb-4 text-primary">
              <span className="material-symbols-outlined text-2xl">key</span>
              <h2 className="text-xl font-bold text-slate-900">{t('help.checkScopeTitle')}</h2>
            </div>
            <p className="text-slate-600 mb-4">{t('help.checkScopeDesc')}</p>
            <ol className="list-decimal list-outside ml-5 space-y-2 text-slate-600 marker:text-slate-400 marker:font-medium">
              <li>{t('help.checkScopeStep1')}</li>
              <li>{t('help.checkScopeStep2')}</li>
              <li>{t('help.checkScopeStep3')}</li>
            </ol>
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
               <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
               <p className="text-sm text-amber-800">{t('help.checkScopeWarning')}</p>
            </div>
          </section>

          <div className="h-px bg-slate-100 w-full"></div>

          <section>
            <div className="flex items-center gap-3 mb-4 text-indigo-500">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
              <h2 className="text-xl font-bold text-slate-900">{t('help.grantAccessTitle')}</h2>
            </div>
            <p className="text-slate-600 mb-4">{t('help.grantAccessDesc')}</p>
            <ol className="list-decimal list-outside ml-5 space-y-2 text-slate-600 marker:text-slate-400 marker:font-medium">
              <li>{t('help.grantAccessStep1')}</li>
              <li>{t('help.grantAccessStep2')}</li>
              <li>{t('help.grantAccessStep3')}</li>
              <li>{t('help.grantAccessStep4')}</li>
            </ol>
            <p className="text-slate-500 mt-6 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
              {t('help.grantAccessOrgPolicy')}{' '}
              <a 
                href="https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/disabling-oauth-app-access-restrictions-for-your-organization"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline hover:text-primary-hover font-semibold"
              >
                {t('help.grantAccessOrgPolicyLink')}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
