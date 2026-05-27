import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DependencyLines } from './DependencyLines';
import type { DashboardItem, Task } from '../../../types';

const buildTask = (index: number): Task => ({
  kind: 'task',
  id: `task-${index}`,
  itemId: `item-${index}`,
  displayId: `#${index}`,
  title: `Task ${index}`,
  status: 'Todo',
  startDate: `2026-05-0${index}`,
  targetDate: `2026-05-0${index + 1}`,
  assignees: [],
  progress: 0,
  groupPath: [],
});

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback || key,
    }),
  };
});

describe('DependencyLines drag preview', () => {
  it('renders snapped dependency previews as thin emerald lines', () => {
    const items: DashboardItem[] = [buildTask(1), buildTask(2)];
    const positions: Record<string, number> = {
      '2026-05-01': 0,
      '2026-05-02': 120,
      '2026-05-03': 240,
    };

    render(
      <DependencyLines
        items={items}
        getPositionForDate={(dateStr) => positions[dateStr] ?? 0}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={{ startX: 120, startY: 36, currentX: 220, currentY: 80 }}
        hoveredTargetTaskId="task-2"
      />
    );

    const snappedLine = screen.getByTestId('dependency-drag-preview');

    expect(snappedLine.getAttribute('stroke')).toBe('#10b981');
    expect(snappedLine.getAttribute('stroke-width')).toBe('2.5');
    expect(snappedLine.getAttribute('stroke-dasharray')).toBe('3 5');
    expect(snappedLine.getAttribute('marker-end')).toBe('url(#arrowhead-snap)');
    expect(snappedLine.getAttribute('d')).toMatch(/120 108$/);
  });
});
