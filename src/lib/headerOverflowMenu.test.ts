import { describe, expect, it } from 'vitest';
import { hasHeaderOverflowMenuItems, type HeaderOverflowVisibility } from './headerOverflowMenu';

const allVisible = (): HeaderOverflowVisibility => ({
  hasProject: true,
  isProjectSelectorVisible: true,
  isViewSwitcherVisible: true,
  isSettingsVisible: true,
  isSyncVisible: true,
  isLanguageVisible: true,
  isAccountVisible: true,
  isAboutVisible: true,
});

describe('hasHeaderOverflowMenuItems', () => {
  it('returns false when every tracked header item is visible', () => {
    expect(hasHeaderOverflowMenuItems(allVisible())).toBe(false);
  });

  it('returns true when a standard header item is hidden', () => {
    expect(hasHeaderOverflowMenuItems({ ...allVisible(), isLanguageVisible: false })).toBe(true);
    expect(hasHeaderOverflowMenuItems({ ...allVisible(), isAccountVisible: false })).toBe(true);
  });

  it('returns true when project-only items are hidden', () => {
    expect(hasHeaderOverflowMenuItems({ ...allVisible(), isViewSwitcherVisible: false })).toBe(true);
    expect(hasHeaderOverflowMenuItems({ ...allVisible(), isSettingsVisible: false })).toBe(true);
  });

  it('ignores project-only overflow entries when no project is open', () => {
    expect(
      hasHeaderOverflowMenuItems({
        ...allVisible(),
        hasProject: false,
        isViewSwitcherVisible: false,
        isSettingsVisible: false,
      }),
    ).toBe(false);
  });
});