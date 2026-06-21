import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UI_LOCALE_STORAGE_KEY,
  changeUiLanguage,
  detectBrowserUiLocale,
  getSavedUiLocale,
  resolveInitialUiLocale,
  saveUiLocale,
} from './uiLocaleStorage';

describe('uiLocaleStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('detects browser locales from navigator language tags', () => {
    expect(detectBrowserUiLocale(['ja-JP'])).toBe('ja');
    expect(detectBrowserUiLocale(['zh-CN'])).toBe('zh-CN');
    expect(detectBrowserUiLocale(['zh-TW'])).toBe('zh-TW');
    expect(detectBrowserUiLocale(['en-US'])).toBe('en');
    expect(detectBrowserUiLocale(['fr-FR'])).toBe('en');
  });

  it('uses saved locale when present', () => {
    saveUiLocale('ja');
    expect(getSavedUiLocale()).toBe('ja');
    expect(resolveInitialUiLocale(['en-US'])).toBe('ja');
  });

  it('detects and persists browser locale when storage is empty', () => {
    expect(resolveInitialUiLocale(['zh-TW', 'en-US'])).toBe('zh-TW');
    expect(localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe('zh-TW');
  });

  it('persists locale when user changes language', () => {
    const i18n = { changeLanguage: vi.fn() };
    changeUiLanguage(i18n, 'zh-CN');
    expect(i18n.changeLanguage).toHaveBeenCalledWith('zh-CN');
    expect(localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe('zh-CN');
  });
});