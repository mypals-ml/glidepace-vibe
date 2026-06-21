import type { CSSProperties } from 'react';
import type { TFunction } from 'i18next';
import type { ForecastPoint, ForecastStatusKey } from '../../../lib/forecastDashboardUtils';

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 220;
export const CHART_TOP = 14;
export const CHART_BOTTOM = 198;
export const CHART_PLOT_HEIGHT = CHART_BOTTOM - CHART_TOP;
export const CHART_ACTUAL_FILL_OPACITY = 0.22;
export const CHART_PROJECTED_FILL_OPACITY = 0.2;

export function formatDays(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}d`;
}

export function formatLocalizedDays(value: number, t: TFunction) {
  const count = value.toFixed(value % 1 === 0 ? 0 : 1);
  const template = t('dashboard.burndownDaysValue', { count, defaultValue: '{{count}}d' });
  return typeof template === 'string' ? template.replace('{{count}}', count) : `${count}d`;
}

function normalizeForecastStatusLabel(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function translateForecastStatusLabel(status: string, statusKey: ForecastStatusKey, t: TFunction) {
  const translationByStatus: Record<string, { key: string; defaultValue: string }> = {
    draft: { key: 'dashboard.burndownAssumptionDraft', defaultValue: 'Draft' },
    todo: { key: 'dashboard.burndownAssumptionTodo', defaultValue: 'Todo' },
    'to do': { key: 'dashboard.burndownAssumptionTodo', defaultValue: 'Todo' },
    backlog: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    open: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    'not started': { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    'in progress': { key: 'dashboard.burndownAssumptionInProgress', defaultValue: 'In progress' },
    'in review': { key: 'dashboard.burndownAssumptionInReview', defaultValue: 'In review' },
    review: { key: 'dashboard.burndownAssumptionInReview', defaultValue: 'In review' },
    wip: { key: 'dashboard.burndownInFlight', defaultValue: 'In progress or review' },
    done: { key: 'dashboard.burndownAssumptionDone', defaultValue: 'Done' },
    closed: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    completed: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    merged: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    blocked: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    'on hold': { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    cancelled: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    canceled: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    other: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
  };
  const exactTranslation = translationByStatus[normalizeForecastStatusLabel(status)];
  if (exactTranslation) {
    return t(exactTranslation.key, exactTranslation.defaultValue);
  }

  const translationByStatusKey: Record<ForecastStatusKey, { key: string; defaultValue: string }> = {
    done: { key: 'dashboard.burndownAssumptionDone', defaultValue: 'Done' },
    todo: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    inFlight: { key: 'dashboard.burndownInFlight', defaultValue: 'In progress or review' },
  };

  const fallbackTranslation = translationByStatusKey[statusKey];
  return t(fallbackTranslation.key, fallbackTranslation.defaultValue);
}

export function pointCoordinates(points: ForecastPoint[], totalEstimateDays: number) {
  const denominator = Math.max(1, totalEstimateDays);
  const lastIndex = Math.max(1, points.length - 1);
  return points.map((point, index) => ({
    ...point,
    x: (index / lastIndex) * CHART_WIDTH,
    y: CHART_BOTTOM - (point.remainingDays / denominator) * CHART_PLOT_HEIGHT,
  }));
}

export function pointList(points: Array<ForecastPoint & { x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

export function areaPath(points: Array<ForecastPoint & { x: number; y: number }>) {
  if (points.length < 2) return '';
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${CHART_BOTTOM} L ${first.x.toFixed(1)} ${CHART_BOTTOM} Z`;
}

export type DateTickLabel = ForecastPoint & {
  x: number;
  y: number;
  labelKind: 'start' | 'today' | 'completion';
};

export function dateTickCoordinates(points: Array<ForecastPoint & { x: number; y: number }>) {
  const first = points[0];
  const last = points[points.length - 1];
  const actualBoundary = [...points].reverse().find((point) => !point.future);
  return [first, actualBoundary, last].filter((tick, index, ticks): tick is ForecastPoint & { x: number; y: number } => {
    if (!tick) return false;
    return ticks.findIndex((candidate) => candidate?.date === tick.date) === index;
  });
}

export function dateTickLabels(points: Array<ForecastPoint & { x: number; y: number }>): DateTickLabel[] {
  const first = points[0];
  const last = points[points.length - 1];
  const actualBoundary = [...points].reverse().find((point) => !point.future);
  if (!first || !last) return [];

  const labels: DateTickLabel[] = [{ ...first, labelKind: 'start' }];
  if (last.date !== first.date) {
    labels.push({ ...last, labelKind: 'completion' });
  }
  if (actualBoundary && actualBoundary.date !== first.date && actualBoundary.date !== last.date) {
    labels.push({ ...actualBoundary, labelKind: 'today' });
  }
  return labels;
}

export function dateTickLabelClassName(labelKind: DateTickLabel['labelKind'], x: number) {
  if (labelKind === 'start') return 'absolute left-0 top-3 whitespace-nowrap text-left';
  if (labelKind === 'completion') return 'absolute right-0 top-3 whitespace-nowrap text-right';
  return x < CHART_WIDTH / 2
    ? 'absolute top-0 translate-x-2 whitespace-nowrap text-left text-primary'
    : 'absolute top-0 -translate-x-[calc(100%+0.5rem)] whitespace-nowrap text-right text-primary';
}

export function dateTickLabelStyle(labelKind: DateTickLabel['labelKind'], x: number): CSSProperties | undefined {
  if (labelKind !== 'today') return undefined;
  return { left: `${(x / CHART_WIDTH) * 100}%` };
}

export function formatReadOnlyDate(value: string) {
  return value ? value.replaceAll('-', '/') : '-';
}

export function shouldShowWorkerDateLabel(index: number, total: number, step: number) {
  return index === 0 || index === total - 1 || index % step === 0;
}