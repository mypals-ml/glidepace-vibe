export interface HeaderOverflowVisibility {
  hasProject: boolean;
  isProjectSelectorVisible: boolean;
  isViewSwitcherVisible: boolean;
  isSettingsVisible: boolean;
  isSyncVisible: boolean;
  isLanguageVisible: boolean;
  isAccountVisible: boolean;
  isAboutVisible: boolean;
}

/** True when at least one header item is hidden and should appear in the overflow menu. */
export function hasHeaderOverflowMenuItems(visibility: HeaderOverflowVisibility): boolean {
  const {
    hasProject,
    isProjectSelectorVisible,
    isViewSwitcherVisible,
    isSettingsVisible,
    isSyncVisible,
    isLanguageVisible,
    isAccountVisible,
    isAboutVisible,
  } = visibility;

  if (!isProjectSelectorVisible) return true;
  if (hasProject && !isViewSwitcherVisible) return true;
  if (hasProject && !isSettingsVisible) return true;
  if (!isSyncVisible) return true;
  if (!isLanguageVisible) return true;
  if (!isAccountVisible) return true;
  if (!isAboutVisible) return true;

  return false;
}