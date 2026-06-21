export const UI_DASHBOARD_VIEW_STORAGE_KEY = 'ui_dashboard_view';

export type DashboardChartView = 'gantt' | 'forecast';

export interface DashboardViewPreference {
  dashboardView: DashboardChartView;
  isChartVisible: boolean;
}

export const DEFAULT_DASHBOARD_VIEW_PREFERENCE: DashboardViewPreference = {
  dashboardView: 'forecast',
  isChartVisible: true,
};

function isDashboardChartView(value: unknown): value is DashboardChartView {
  return value === 'gantt' || value === 'forecast';
}

function isDashboardViewPreference(value: unknown): value is DashboardViewPreference {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<DashboardViewPreference>;
  return isDashboardChartView(candidate.dashboardView) && typeof candidate.isChartVisible === 'boolean';
}

export function getSavedDashboardViewPreference(): DashboardViewPreference | null {
  if (typeof localStorage === 'undefined') return null;

  const saved = localStorage.getItem(UI_DASHBOARD_VIEW_STORAGE_KEY);
  if (!saved) return null;

  try {
    const parsed: unknown = JSON.parse(saved);
    return isDashboardViewPreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDashboardViewPreference(preference: DashboardViewPreference): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(UI_DASHBOARD_VIEW_STORAGE_KEY, JSON.stringify(preference));
}

export function resolveInitialDashboardViewPreference(): DashboardViewPreference {
  const saved = getSavedDashboardViewPreference();
  if (saved) return saved;

  saveDashboardViewPreference(DEFAULT_DASHBOARD_VIEW_PREFERENCE);
  return DEFAULT_DASHBOARD_VIEW_PREFERENCE;
}

export function toActiveDashboardTab(
  preference: Pick<DashboardViewPreference, 'dashboardView' | 'isChartVisible'>,
): 'list' | DashboardChartView {
  return preference.isChartVisible ? preference.dashboardView : 'list';
}