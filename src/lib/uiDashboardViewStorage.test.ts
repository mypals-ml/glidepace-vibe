import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_VIEW_PREFERENCE,
  UI_DASHBOARD_VIEW_STORAGE_KEY,
  getSavedDashboardViewPreference,
  resolveInitialDashboardViewPreference,
  saveDashboardViewPreference,
  toActiveDashboardTab,
} from './uiDashboardViewStorage';

describe('uiDashboardViewStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to forecast and persists it on first visit', () => {
    expect(resolveInitialDashboardViewPreference()).toEqual(DEFAULT_DASHBOARD_VIEW_PREFERENCE);
    expect(localStorage.getItem(UI_DASHBOARD_VIEW_STORAGE_KEY)).toBe(
      JSON.stringify(DEFAULT_DASHBOARD_VIEW_PREFERENCE),
    );
  });

  it('restores a saved gantt preference', () => {
    saveDashboardViewPreference({ dashboardView: 'gantt', isChartVisible: true });

    expect(resolveInitialDashboardViewPreference()).toEqual({
      dashboardView: 'gantt',
      isChartVisible: true,
    });
  });

  it('restores a saved mobile list preference', () => {
    saveDashboardViewPreference({ dashboardView: 'forecast', isChartVisible: false });

    expect(getSavedDashboardViewPreference()).toEqual({
      dashboardView: 'forecast',
      isChartVisible: false,
    });
    expect(toActiveDashboardTab({ dashboardView: 'forecast', isChartVisible: false })).toBe('list');
  });

  it('ignores invalid saved values', () => {
    localStorage.setItem(UI_DASHBOARD_VIEW_STORAGE_KEY, '{"dashboardView":"invalid","isChartVisible":true}');

    expect(resolveInitialDashboardViewPreference()).toEqual(DEFAULT_DASHBOARD_VIEW_PREFERENCE);
  });
});