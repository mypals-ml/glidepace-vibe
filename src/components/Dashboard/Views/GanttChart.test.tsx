import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GanttChart } from './GanttChart';
import type { DashboardItem, Task } from '../../../types';

const centerOnDate = vi.fn();
const scrollTo = vi.fn();

const buildTask = (index: number): Task => ({
  kind: 'task',
  id: `task-${index}`,
  itemId: `item-${index}`,
  displayId: `#${index}`,
  title: `Task ${index}`,
  status: 'Todo',
  startDate: '2026-05-01',
  targetDate: '2026-05-03',
  assignees: [],
  progress: 0,
  groupPath: [],
});

const tasks = Array.from({ length: 10 }, (_, index) => buildTask(index + 1));
const dashboardItems: DashboardItem[] = [
  {
    kind: 'group',
    groupBlockId: 'project-root',
    name: 'Project',
    path: [],
    depth: 0,
    startTaskIndex: 0,
    endTaskIndex: tasks.length - 1,
    startDate: '2026-05-01',
    targetDate: '2026-05-03',
    childTaskIds: tasks.map(task => task.itemId!),
    isExpanded: true,
    isSyntheticRoot: true,
  },
  ...tasks,
];

let dashboardState = {
  tasks,
  filteredTasks: tasks,
  dashboardItems,
  isLoadingTasks: false,
  requestedCenterDate: null as string | null,
  requestedCenterTaskId: null as string | null,
  centerGanttOnDate: vi.fn(),
  selectedTaskId: 'task-8' as string | null,
  setSelectedTaskId: vi.fn(),
  setIsTaskDetailsOpen: vi.fn(),
  updateTaskSuccessors: vi.fn(),
  isLinkMode: false,
  setIsLinkMode: vi.fn(),
  selectedLinkTaskIds: [] as string[],
  setSelectedLinkTaskIds: vi.fn(),
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

vi.mock('../../../context/DashboardContext', () => ({
  useDashboard: () => dashboardState,
}));

vi.mock('../../../hooks/useGanttTimeline', () => ({
  useGanttTimeline: () => ({
    timelineRange: {
      start: new Date('2026-05-01T00:00:00Z'),
      totalDays: 10,
    },
    getPositionForDate: () => 0,
    handleScroll: vi.fn(),
    centerOnDate,
  }),
}));

vi.mock('./DependencyLines', () => ({
  DependencyLines: () => null,
}));

describe('GanttChart focus behavior', () => {
  beforeEach(() => {
    centerOnDate.mockReset();
    scrollTo.mockReset();
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: null,
      requestedCenterTaskId: null,
      selectedTaskId: 'task-8',
    };
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 288,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not vertically scroll when restoring a saved selected task', () => {
    render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith(expect.any(String), 'auto');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('vertically scrolls when an explicit task focus request is present', () => {
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: '2026-05-01',
      requestedCenterTaskId: 'task-8',
    };

    render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-05-01', 'smooth');
    expect(scrollTo).toHaveBeenCalledWith({
      top: 468,
      behavior: 'auto',
    });
  });
});
