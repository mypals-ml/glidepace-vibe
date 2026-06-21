import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useSortedLocales } from '../../hooks/useLocales';
import { changeUiLanguage } from '../../lib/uiLocaleStorage';
import { UI_LAYER } from '../../lib/uiLayering';
import { OverflowItem, useIsOverflowItemVisible } from '@fluentui/react-overflow';

/**
 * Language selector dropdown.
 * Does NOT wrap itself in OverflowItem — that is done by the parent Header.
 */
export function LanguageSelectorDropdown() {
  const isTextVisible = useIsOverflowItemVisible('language-text');
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
        className="relative flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 transition-all duration-300 rounded-lg shadow-sm overflow-hidden h-[var(--header-button-height)] cursor-pointer focus-within:ring-1 focus-within:ring-primary focus-within:border-primary min-w-[40px]"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <OverflowItem id="language-text" priority={40}>
          <div className={`flex items-center h-full ${!isTextVisible ? 'hidden' : ''}`}>
            <div className="px-3 items-center h-full bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500 flex">{t('app.language')}</div>
            <div className="flex-1 px-3 text-sm font-medium text-slate-700 flex items-center justify-between min-w-0">
              <span className="truncate max-w-[80px]">{currentLocale.label}</span>
              <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
          </div>
        </OverflowItem>
        
        {!isTextVisible && (
          <span className="material-symbols-outlined text-slate-700 text-[20px] px-2.5">language</span>
        )}
      </div>

      {isOpen && (
        <div className={`fixed right-4 top-[var(--app-header-height)] mt-2 w-44 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] ${UI_LAYER.headerDropdown} overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 border border-slate-200/60`}>
          <div className="p-1">
            {sortedLocales.map((locale) => (
              <button
                key={locale.code}
                onClick={() => {
                  changeUiLanguage(i18n, locale.code);
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
