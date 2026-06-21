export const UI_LOCALE_STORAGE_KEY = 'ui_locale';

export const SUPPORTED_UI_LOCALE_CODES = ['en', 'ja', 'zh-CN', 'zh-TW'] as const;
export type UiLocaleCode = (typeof SUPPORTED_UI_LOCALE_CODES)[number];

export function isSupportedUiLocale(code: string): code is UiLocaleCode {
  return (SUPPORTED_UI_LOCALE_CODES as readonly string[]).includes(code);
}

export function detectBrowserUiLocale(
  languages: readonly string[] = typeof navigator !== 'undefined'
    ? [navigator.language, ...(navigator.languages ?? [])]
    : [],
): UiLocaleCode {
  for (const raw of languages) {
    const lang = raw.toLowerCase();

    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant')) {
      return 'zh-TW';
    }
    if (lang.startsWith('zh-cn') || lang.startsWith('zh-hans') || lang === 'zh') {
      return 'zh-CN';
    }
    if (lang.startsWith('zh')) {
      return lang.includes('tw') || lang.includes('hant') || lang.includes('hk') ? 'zh-TW' : 'zh-CN';
    }
    if (lang.startsWith('ja')) {
      return 'ja';
    }
    if (lang.startsWith('en')) {
      return 'en';
    }
  }

  return 'en';
}

export function getSavedUiLocale(): UiLocaleCode | null {
  if (typeof localStorage === 'undefined') return null;

  const saved = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  return saved && isSupportedUiLocale(saved) ? saved : null;
}

export function saveUiLocale(code: UiLocaleCode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(UI_LOCALE_STORAGE_KEY, code);
}

export function resolveInitialUiLocale(
  languages: readonly string[] = typeof navigator !== 'undefined'
    ? [navigator.language, ...(navigator.languages ?? [])]
    : [],
): UiLocaleCode {
  const saved = getSavedUiLocale();
  if (saved) return saved;

  const detected = detectBrowserUiLocale(languages);
  saveUiLocale(detected);
  return detected;
}

export function changeUiLanguage(
  i18n: { changeLanguage: (lng: string) => void | Promise<unknown> },
  code: string,
): void {
  if (!isSupportedUiLocale(code)) return;

  saveUiLocale(code);
  void i18n.changeLanguage(code);
}