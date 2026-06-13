import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DependencyLines } from './DependencyLines';
import type { DashboardItem, Task, TaskGroupBlock } from '../../../types';

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

const buildGroupBlock = (overrides: Partial<TaskGroupBlock>): TaskGroupBlock => ({
  kind: 'group',
  groupBlockId: 'group-1',
  name: 'Group 1',
  path: ['Group 1'],
  depth: 1,
  startTaskIndex: 0,
  endTaskIndex: 0,
  startDate: '2026-05-03',
  targetDate: '2026-05-05',
  childTaskIds: [],
  isExpanded: false,
  ...overrides,
});

const POSITIONS: Record<string, number> = {
  '2026-05-01': 0,
  '2026-05-02': 120,
  '2026-05-03': 240,
  '2026-05-04': 360,
  '2026-05-05': 480,
  '2026-05-06': 600,
  '2026-05-07': 720,
};

const getPosition = (dateStr: string) => POSITIONS[dateStr] ?? 0;

const getLinePaths = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.dependency-line')).map(path => path.getAttribute('d') || '');

const getBreakLinkButton = (container: HTMLElement): Element => {
  const button = container.querySelector('foreignObject');
  expect(button).not.toBeNull();
  return button as Element;
};

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

describe('DependencyLines with folded group cards', () => {
  // Folded card geometry, mirroring the GanttChart card: span 2026-05-03 ->
  // 2026-05-05 at dayWidth 120 with CARD_PAD 9: left = 240 - 9 = 231,
  // width = 3 * 120 + 18, so right = 609.

  it('still draws visible task-to-task lines when no tasks prop is provided', () => {
    const source = { ...buildTask(1), successorIds: ['item-2'] };
    const items: DashboardItem[] = [source, buildTask(2)];

    const { container } = render(
      <DependencyLines
        items={items}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
      />
    );

    const paths = getLinePaths(container);
    expect(paths).toHaveLength(1);
    expect(paths[0].startsWith('M 240 36')).toBe(true);
    expect(paths[0].endsWith('120 108')).toBe(true);
  });

  it('points a line from an outside predecessor to the folded card title bar', () => {
    const predecessor = { ...buildTask(1), successorIds: ['item-2'] };
    const hidden = buildTask(2);
    const group = buildGroupBlock({ childTaskIds: ['item-2'] });
    const items: DashboardItem[] = [predecessor, group];

    const { container } = render(
      <DependencyLines
        items={items}
        tasks={[predecessor, hidden]}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
      />
    );

    const paths = getLinePaths(container);
    expect(paths).toHaveLength(1);
    // Source: visible predecessor bar end (240, row 0 center 36).
    expect(paths[0].startsWith('M 240 36')).toBe(true);
    // Target: folded card's left edge at the title bar (231, row 1 center 108).
    expect(paths[0].endsWith('231 108')).toBe(true);
  });

  it('starts a line at the folded card title bar for a successor outside the group', () => {
    const hidden = { ...buildTask(2), successorIds: ['item-6'] };
    const outsideSuccessor = buildTask(6);
    const group = buildGroupBlock({ childTaskIds: ['item-2'] });
    const items: DashboardItem[] = [group, outsideSuccessor];

    const { container } = render(
      <DependencyLines
        items={items}
        tasks={[hidden, outsideSuccessor]}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
      />
    );

    const paths = getLinePaths(container);
    expect(paths).toHaveLength(1);
    // Source: folded card's right edge at the title bar (609, row 0 center 36).
    expect(paths[0].startsWith('M 609 36')).toBe(true);
    // Target: visible successor bar start (600, row 1 center 108).
    expect(paths[0].endsWith('600 108')).toBe(true);
  });

  it('hides links that are fully inside one folded card', () => {
    const hiddenSource = { ...buildTask(2), successorIds: ['item-3'] };
    const hiddenTarget = buildTask(3);
    const group = buildGroupBlock({ childTaskIds: ['item-2', 'item-3'] });
    const items: DashboardItem[] = [group];

    const { container } = render(
      <DependencyLines
        items={items}
        tasks={[hiddenSource, hiddenTarget]}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
      />
    );

    expect(getLinePaths(container)).toHaveLength(0);
  });

  it('draws one line when multiple hidden tasks link to the same outside successor', () => {
    const hiddenA = { ...buildTask(2), successorIds: ['item-6'] };
    const hiddenB = { ...buildTask(3), successorIds: ['item-6'] };
    const outsideSuccessor = buildTask(6);
    const group = buildGroupBlock({ childTaskIds: ['item-2', 'item-3'] });
    const items: DashboardItem[] = [group, outsideSuccessor];

    const { container } = render(
      <DependencyLines
        items={items}
        tasks={[hiddenA, hiddenB, outsideSuccessor]}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
      />
    );

    expect(getLinePaths(container)).toHaveLength(1);
  });
});

describe('DependencyLines break-link button placement', () => {
  it('keeps the hover break-link button inside the visible viewport', () => {
    const source = { ...buildTask(1), successorIds: ['item-6'] };
    const target = buildTask(6);
    const items: DashboardItem[] = [source, target];

    const { container } = render(
      <DependencyLines
        items={items}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
        viewportInfo={{ scrollLeft: 500, scrollTop: 90, clientWidth: 100, clientHeight: 80 }}
      />
    );

    const breakLinkButton = getBreakLinkButton(container);

    expect(breakLinkButton.getAttribute('x')).toBe('500');
    expect(breakLinkButton.getAttribute('y')).toBe('90');
  });

  it('keeps the hover break-link button inside the right viewport edge', () => {
    const source = { ...buildTask(1), successorIds: ['item-6'] };
    const target = buildTask(6);
    const items: DashboardItem[] = [source, target];

    const { container } = render(
      <DependencyLines
        items={items}
        getPositionForDate={getPosition}
        dayWidth={120}
        onBreakLink={vi.fn()}
        dragState={null}
        viewportInfo={{ scrollLeft: 0, scrollTop: 0, clientWidth: 100, clientHeight: 200 }}
      />
    );

    const breakLinkButton = getBreakLinkButton(container);

    expect(breakLinkButton.getAttribute('x')).toBe('76');
    expect(breakLinkButton.getAttribute('y')).toBe('60');
  });
});
