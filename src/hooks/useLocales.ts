import { useTranslation } from 'react-i18next';

export interface Locale {
  code: string;
  label: string;
}

const SUPPORTED_LOCALES = [
  { code: 'en', key: 'app.locales.en' },
  { code: 'ja', key: 'app.locales.ja' },
  { code: 'zh-CN', key: 'app.locales.zhCN' },
  { code: 'zh-TW', key: 'app.locales.zhTW' },
];

export function useSortedLocales(): Locale[] {
  const { t } = useTranslation();

  return SUPPORTED_LOCALES.map(locale => ({
    code: locale.code,
    label: t(locale.key)
  })).sort((a, b) => a.label.localeCompare(b.label));
}
