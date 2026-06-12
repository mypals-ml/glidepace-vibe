import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
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
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already escapes values naturally
    }
  });

export default i18n;
