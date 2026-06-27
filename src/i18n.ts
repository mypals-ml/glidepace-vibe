import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resolveInitialUiLocale } from './lib/uiLocaleStorage';
import en from './locales/en';
import ja from './locales/ja';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';

// Locale resources are modularized into separate files under src/locales/
const resources = {
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveInitialUiLocale(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already escapes values naturally
    }
  });

// Keep <html lang> in sync so locale-aware font fallbacks (see :lang rules in index.css)
// select the correct CJK font for the active language.
function syncDocumentLang(lng: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
}

syncDocumentLang(i18n.language);
i18n.on('languageChanged', syncDocumentLang);

export default i18n;
