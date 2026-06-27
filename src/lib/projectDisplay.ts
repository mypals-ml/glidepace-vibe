export const PROJECT_TITLE_LOADING_PLACEHOLDER = 'Loading...';

export function isProjectTitleLoadingPlaceholder(title: string | null | undefined) {
  return title === PROJECT_TITLE_LOADING_PLACEHOLDER;
}

export function getProjectDisplayTitle(title: string | null | undefined, fallback: string) {
  return title && !isProjectTitleLoadingPlaceholder(title) ? title : fallback;
}

export function getSavedProjectHistoryTitle(projectId: string | null | undefined, accountId?: string) {
  try {
    const saved = localStorage.getItem('project_history');
    if (!saved) return '';

    const history = JSON.parse(saved) as Array<{ id?: string; title?: string; accountId?: string }>;
    const exactMatch = projectId ? history.find(item => item.id === projectId) : undefined;
    if (exactMatch?.title) return exactMatch.title;

    const accountMatches = accountId ? history.filter(item => item.accountId === accountId) : [];
    if (accountMatches.length === 1) return accountMatches[0].title || '';

    return history.length === 1 ? history[0].title || '' : '';
  } catch {
    return '';
  }
}
