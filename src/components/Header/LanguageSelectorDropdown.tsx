import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useSortedLocales } from '../../hooks/useLocales';

export function LanguageSelectorDropdown() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const sortedLocales = useSortedLocales();
  const currentLocale = sortedLocales.find(l => l.code === i18n.language) || sortedLocales[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 lg:hover:bg-white transition-colors rounded-lg lg:rounded-md shadow-sm overflow-hidden h-[var(--header-button-height)] w-[var(--header-button-height)] lg:w-44 shrink-0 cursor-pointer focus-within:ring-1 focus-within:ring-primary focus-within:border-primary"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="hidden lg:flex px-3 items-center h-full bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500">{t('app.language')}</div>
        <div className="flex-1 px-3 text-sm font-medium text-slate-700 hidden lg:flex items-center justify-between min-w-0">
          <span className="truncate">{currentLocale.label}</span>
          <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
        <span className="material-symbols-outlined lg:hidden text-slate-700 text-[20px]">language</span>
      </div>

      {isOpen && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[72px] sm:top-full mt-2 w-auto sm:w-44 bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 border border-slate-200/60">
          <div className="p-1">
            {sortedLocales.map((locale) => (
              <button
                key={locale.code}
                onClick={() => {
                  i18n.changeLanguage(locale.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${i18n.language === locale.code ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                role="option"
                aria-selected={i18n.language === locale.code}
              >
                <span className="truncate">{locale.label}</span>
                {i18n.language === locale.code && <span className="material-symbols-outlined text-sm flex-shrink-0">check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
