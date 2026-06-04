import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GanttChart } from './GanttChart';
import type { DashboardItem, Task } from '../../../types';

const centerOnDate = vi.fn();
const scrollTo = vi.fn();
let timelineExpansionVersion = 0;

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
  completeGanttCenterRequest: vi.fn(),
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
    timelineExpansionVersion,
  }),
}));

vi.mock('./DependencyLines', () => ({
  DependencyLines: () => null,
}));

describe('GanttChart focus behavior', () => {
  beforeEach(() => {
    centerOnDate.mockReset();
    centerOnDate.mockReturnValue(true);
    scrollTo.mockReset();
    timelineExpansionVersion = 0;
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: null,
      requestedCenterTaskId: null,
      completeGanttCenterRequest: vi.fn(),
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
    const completeGanttCenterRequest = vi.fn();
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: '2026-05-01',
      requestedCenterTaskId: 'task-8',
      completeGanttCenterRequest,
    };

    const { container } = render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-05-01', 'smooth');
    expect(container.querySelector('.overflow-auto')?.scrollTop).toBe(468);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).toHaveBeenCalledTimes(1);
  });

  it('completes date-only center requests after the chart consumes them', () => {
    const completeGanttCenterRequest = vi.fn();
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: '2026-05-01',
      requestedCenterTaskId: null,
      completeGanttCenterRequest,
    };

    render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-05-01', 'smooth');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps task focus requests pending while horizontal centering is deferred', () => {
    const completeGanttCenterRequest = vi.fn();
    centerOnDate.mockReturnValue(false);
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: '2026-04-01',
      requestedCenterTaskId: 'task-8',
      completeGanttCenterRequest,
    };

    render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-04-01', 'smooth');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).not.toHaveBeenCalled();
  });

  it('retries pending task focus requests when timeline expansion is applied', () => {
    const completeGanttCenterRequest = vi.fn();
    let smoothCenterAttempts = 0;
    centerOnDate.mockImplementation((_date: string, behavior: ScrollBehavior) => {
      if (behavior !== 'smooth') return true;
      smoothCenterAttempts += 1;
      return smoothCenterAttempts > 1;
    });
    dashboardState = {
      ...dashboardState,
      requestedCenterDate: '2026-04-01',
      requestedCenterTaskId: 'task-8',
      completeGanttCenterRequest,
    };

    const { container, rerender } = render(<GanttChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-04-01', 'smooth');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).not.toHaveBeenCalled();

    timelineExpansionVersion += 1;
    rerender(<GanttChart />);

    expect(smoothCenterAttempts).toBe(2);
    expect(container.querySelector('.overflow-auto')?.scrollTop).toBe(468);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).toHaveBeenCalledTimes(1);
  });

  it('disables text selection on gantt task bars for long-press interactions', () => {
    render(<GanttChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });

    expect(taskBar.className).toContain('select-none');
    expect(taskBar.getAttribute('style')).toContain('user-select: none');
    expect(taskBar.getAttribute('style')).toContain('-webkit-user-select: none');
    expect(taskBar.getAttribute('style')).toContain('touch-action: manipulation');
  });

  it('shows group progress as text without a group-title progress bar', () => {
    const groupTasks = [
      { ...buildTask(1), progress: 100 },
      { ...buildTask(2), progress: 0 },
    ];
    const groupDashboardItems: DashboardItem[] = [
      {
        kind: 'group',
        groupBlockId: 'project-root',
        name: 'Project',
        path: [],
        depth: 0,
        startTaskIndex: 0,
        endTaskIndex: groupTasks.length - 1,
        startDate: '2026-05-01',
        targetDate: '2026-05-03',
        childTaskIds: groupTasks.map(task => task.id),
        isExpanded: true,
        isSyntheticRoot: true,
      },
      ...groupTasks,
    ];

    dashboardState = {
      ...dashboardState,
      tasks: groupTasks,
      filteredTasks: groupTasks,
      dashboardItems: groupDashboardItems,
      selectedTaskId: null,
    };

    render(<GanttChart />);

    const groupTitle = screen.getByRole('button', { name: /project2 tasks50%/i });

    expect(groupTitle.textContent).toContain('50%');
    expect(
      Array.from(groupTitle.querySelectorAll('span')).some(element =>
        element.className.includes('w-[46px]')
      )
    ).toBe(false);
  });
});
