import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { ForecastPoint } from '../../../lib/forecastDashboardUtils';
import {
  areaPath,
  dateTickLabelClassName,
  dateTickLabels,
  formatReadOnlyDate,
  pointCoordinates,
  translateForecastStatusLabel,
} from './forecastDashboardChartUtils';

const t = ((_key: string, fallback?: string) => fallback ?? _key) as TFunction;

const samplePoints: ForecastPoint[] = [
  { date: '2026-06-18', remainingDays: 3, doneDays: 0, future: false },
  { date: '2026-06-19', remainingDays: 2, doneDays: 1, future: false },
  { date: '2026-06-24', remainingDays: 0, doneDays: 3, future: true },
];

describe('forecastDashboardChartUtils', () => {
  it('maps forecast points into chart coordinates', () => {
    const coordinates = pointCoordinates(samplePoints, 3);

    expect(coordinates[0]?.x).toBe(0);
    expect(coordinates.at(-1)?.x).toBe(1000);
    expect(coordinates[0]?.y).toBeLessThan(coordinates.at(-1)?.y ?? 0);
  });

  it('builds a closed area path for chart fills', () => {
    const coordinates = pointCoordinates(samplePoints, 3);
    const path = areaPath(coordinates);

    expect(path.startsWith('M 0.0')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('198.0');
  });

  it('labels start, today, and completion ticks distinctly', () => {
    const coordinates = pointCoordinates(samplePoints, 3);
    const labels = dateTickLabels(coordinates);

    expect(labels.map((label) => label.labelKind)).toEqual(['start', 'completion', 'today']);
    expect(dateTickLabelClassName('start', 0)).toContain('left-0');
    expect(dateTickLabelClassName('start', 0)).toContain('top-3');
    expect(dateTickLabelClassName('completion', 1000)).toContain('right-0');
    expect(dateTickLabelClassName('completion', 1000)).toContain('top-3');
    expect(dateTickLabelClassName('today', 200)).toContain('translate-x-2');
    expect(dateTickLabelClassName('today', 200)).toContain('top-0');
  });

  it('formats read-only dates with slashes', () => {
    expect(formatReadOnlyDate('2026-06-19')).toBe('2026/06/19');
    expect(formatReadOnlyDate('')).toBe('-');
  });

  it('translates unknown statuses using the status-key fallback', () => {
    expect(translateForecastStatusLabel('Ready for deploy', 'todo', t)).toBe('Todo');
  });
});