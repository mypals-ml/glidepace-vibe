import { describe, expect, it } from 'vitest';
import {
  isGitHubRateLimitError,
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
  GitHubRequestFailedError,
} from './githubService';
import githubServiceSrc from './githubService.ts?raw';
import githubRateLimiterSrc from './githubRateLimiter.ts?raw';
import en from '../locales/en';
import ja from '../locales/ja';
import zhCN from '../locales/zh-CN';
import zhTW from '../locales/zh-TW';

describe('Phase 2 — typed error detection', () => {
  it('detects primary and secondary rate-limit errors only', () => {
    expect(isGitHubRateLimitError(new GitHubRateLimitError('x'))).toBe(true);
    expect(isGitHubRateLimitError(new GitHubSecondaryRateLimitError('x'))).toBe(true);
    expect(isGitHubRateLimitError(new GitHubRequestFailedError('x', 500))).toBe(false);
    expect(isGitHubRateLimitError(new Error('generic'))).toBe(false);
    expect(isGitHubRateLimitError(null)).toBe(false);
  });
});

describe('Phase 2 — localized rate-limit strings exist in every locale', () => {
  const keys = ['rateLimitRetrying', 'rateLimitShowingStale', 'rateLimitDeferred'] as const;
  const locales: Array<[string, Record<string, unknown>]> = [
    ['en', en],
    ['ja', ja],
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
  ];

  for (const [name, bundle] of locales) {
    it(`${name} has all rate-limit keys and they are non-empty`, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dashboard = (bundle as any).translation.dashboard;
      for (const key of keys) {
        expect(typeof dashboard[key]).toBe('string');
        expect(dashboard[key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Phase 2 — service transport stays UI-free', () => {
  it('githubService.ts imports no React/i18n/UI modules', () => {
    expect(githubServiceSrc).not.toMatch(/from ['"]react['"]/);
    expect(githubServiceSrc).not.toMatch(/react-i18next/);
    expect(githubServiceSrc).not.toMatch(/showToast/);
  });

  it('githubRateLimiter.ts imports no React/i18n/UI modules', () => {
    expect(githubRateLimiterSrc).not.toMatch(/from ['"]react['"]/);
    expect(githubRateLimiterSrc).not.toMatch(/react-i18next/);
    expect(githubRateLimiterSrc).not.toMatch(/showToast/);
  });
});
