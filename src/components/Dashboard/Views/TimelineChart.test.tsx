import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineChart } from './TimelineChart';
import { buildTimelineTaskBarDropPlan, getGroupTitleLayout } from './timelineChartUtils';
import type { DashboardItem, Task } from '../../../types';

const centerOnDate = vi.fn();
const scrollTo = vi.fn();
let timelineExpansionVersion = 0;
let isMobileViewport = false;

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
  updateTaskDates: vi.fn(),
  updateTaskSuccessors: vi.fn(),
  selectedGroupFieldIds: [] as string[],
  projectFields: [],
  isLinkMode: false,
  setIsLinkMode: vi.fn(),
  selectedLinkTaskIds: [] as string[],
  setSelectedLinkTaskIds: vi.fn(),
  toggleGroupBlockCollapsed: vi.fn(),
  reorderTask: vi.fn(),
  reorderTaskBlock: vi.fn(),
  moveTaskToGroupPath: vi.fn(),
  ganttZoomPercent: 100,
  setGanttZoomPercent: vi.fn(),
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

vi.mock('../../../hooks/useTimelineChart', () => ({
  useTimelineChart: () => ({
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

describe('TimelineChart focus behavior', () => {
  beforeEach(() => {
    isMobileViewport = false;
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
      ganttZoomPercent: 100,
      setGanttZoomPercent: vi.fn(),
      updateTaskDates: vi.fn(),
      updateTaskSuccessors: vi.fn(),
      reorderTask: vi.fn(),
      reorderTaskBlock: vi.fn(),
      moveTaskToGroupPath: vi.fn(),
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
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)' ? isMobileViewport : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not vertically scroll when restoring a saved selected task', () => {
    render(<TimelineChart />);

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

    const { container } = render(<TimelineChart />);

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

    render(<TimelineChart />);

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

    render(<TimelineChart />);

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

    const { container, rerender } = render(<TimelineChart />);

    expect(centerOnDate).toHaveBeenCalledWith('2026-04-01', 'smooth');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).not.toHaveBeenCalled();

    timelineExpansionVersion += 1;
    rerender(<TimelineChart />);

    expect(smoothCenterAttempts).toBe(2);
    expect(container.querySelector('.overflow-auto')?.scrollTop).toBe(468);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(completeGanttCenterRequest).toHaveBeenCalledTimes(1);
  });

  it('disables text selection on gantt task bars for long-press interactions', () => {
    render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });

    expect(taskBar.className).toContain('select-none');
    expect(taskBar.getAttribute('style')).toContain('user-select: none');
    expect(taskBar.getAttribute('style')).toContain('-webkit-user-select: none');
    expect(taskBar.getAttribute('style')).toContain('touch-action: manipulation');
  });

  it('does not show progress bars or percent text on task bars', () => {
    const progressTask = { ...buildTask(1), progress: 50 };
    dashboardState = {
      ...dashboardState,
      tasks: [progressTask],
      filteredTasks: [progressTask],
      dashboardItems: [progressTask],
      selectedTaskId: null,
    };

    render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });

    expect(taskBar.textContent).not.toContain('50%');
    expect(
      Array.from(taskBar.querySelectorAll('div')).some(element =>
        element.className.includes('bg-black/10')
      )
    ).toBe(false);
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

    render(<TimelineChart />);

    const groupTitle = screen.getByRole('button', { name: /project2 tasks50%/i });

    expect(groupTitle.textContent).toContain('50%');
    expect(
      Array.from(groupTitle.querySelectorAll('span')).some(element =>
        element.className.includes('w-[46px]')
      )
    ).toBe(false);
  });

  it('progressively hides group title metadata when the group card is too narrow', () => {
    expect(getGroupTitleLayout(220)).toMatchObject({
      showTaskCount: true,
      showProgress: true,
      nameMaxWidth: 68,
    });
    expect(getGroupTitleLayout(150)).toMatchObject({
      showTaskCount: true,
      showProgress: false,
      nameMaxWidth: 43,
    });
    expect(getGroupTitleLayout(118)).toMatchObject({
      showTaskCount: false,
      showProgress: false,
      nameMaxWidth: 68,
    });
  });

  it('removes right-side group title metadata before it can leave the card frame', () => {
    expect(getGroupTitleLayout(193)).toMatchObject({
      showTaskCount: true,
      showProgress: false,
    });
    expect(getGroupTitleLayout(194)).toMatchObject({
      showTaskCount: true,
      showProgress: true,
    });
    expect(getGroupTitleLayout(148)).toMatchObject({
      showTaskCount: false,
      showProgress: false,
    });
    expect(getGroupTitleLayout(149)).toMatchObject({
      showTaskCount: true,
      showProgress: false,
    });
  });

  it('truncates narrow group titles and hides metadata that would leave the card frame', () => {
    const groupTasks = [
      { ...buildTask(1), progress: 100 },
      { ...buildTask(2), progress: 0 },
    ];
    const groupDashboardItems: DashboardItem[] = [
      {
        kind: 'group',
        groupBlockId: 'project-root',
        name: 'Project with a very long title',
        path: [],
        depth: 0,
        startTaskIndex: 0,
        endTaskIndex: groupTasks.length - 1,
        startDate: '2026-05-01',
        targetDate: '2026-05-01',
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
      ganttZoomPercent: 50,
    };

    render(<TimelineChart />);

    const groupTitle = screen.getByRole('button', { name: /project with a very long title/i });
    const titleName = screen.getByText('Project with a very long title');

    expect(groupTitle.textContent).not.toContain('tasks');
    expect(groupTitle.textContent).not.toContain('50%');
    expect(titleName.className).toContain('text-ellipsis');
    expect(titleName.getAttribute('style')).toContain('max-width:');
  });

  it('builds a horizontal task bar drag plan that shifts the task start date', () => {
    const plan = buildTimelineTaskBarDropPlan({
      task: tasks[0],
      dashboardItems,
      orderedTasks: tasks,
      overRowIndex: 1,
      deltaDays: 3,
      fieldGroupContext: { fieldIds: [], fields: [] },
    });

    expect(plan.startDate).toBe('2026-05-04');
    expect(plan.movePlan).toBeUndefined();
    expect(plan.groupDropPlan).toBeUndefined();
  });

  it('builds a vertical task bar drag plan using the existing visible reorder rules', () => {
    const plan = buildTimelineTaskBarDropPlan({
      task: tasks[0],
      dashboardItems,
      orderedTasks: tasks,
      overRowIndex: 3,
      deltaDays: 0,
      fieldGroupContext: { fieldIds: [], fields: [] },
    });

    expect(plan.startDate).toBeUndefined();
    expect(plan.movePlan).toMatchObject({
      taskIds: ['item-1'],
      afterTaskId: 'item-3',
    });
  });

  it('moves the whole gantt row visually while a task bar is dragged vertically', () => {
    render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });
    const taskRow = taskBar.parentElement;

    fireEvent.pointerDown(taskBar, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(taskBar, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 116,
      clientY: 172,
    });

    expect(taskRow?.getAttribute('style')).toContain('transform: translateY(72px)');
    expect(taskRow?.className).toContain('shadow-lg');
    expect(taskRow?.className).toContain('ring-primary/20');
    expect(taskRow?.className).toContain('bg-white');
    expect(taskBar.getAttribute('style')).toContain('transform: translateX(16px)');
  });

  it('lets dependency lines receive hover events through empty gantt row space', () => {
    const { container } = render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });
    const taskRow = taskBar.parentElement;

    expect(taskRow?.className).toContain('pointer-events-none');
    expect(taskBar.className).toContain('pointer-events-auto');
    expect(container.querySelectorAll('[data-gantt-link-handle="true"]')[0]?.className).toContain('pointer-events-auto');
  });

  it('does not show a mobile gantt context menu move action', () => {
    isMobileViewport = true;

    render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });
    fireEvent.contextMenu(taskBar, { clientX: 120, clientY: 120 });

    expect(screen.queryByRole('button', { name: /move task/i })).toBeNull();
    expect(screen.getByRole('button', { name: /addSuccessors/i })).toBeTruthy();
  });

  it('hides gantt link handles while a task bar is being dragged', () => {
    const { container } = render(<TimelineChart />);

    const taskBar = screen.getByRole('button', { name: /#1 task 1/i });
    fireEvent.pointerDown(taskBar, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 100,
    });

    const linkHandles = container.querySelectorAll('[data-gantt-link-handle="true"]');
    const taskOneHandles = Array.from(linkHandles).filter((handle) =>
      handle.className.includes('pointer-events-none') && handle.className.includes('opacity-0')
    );

    expect(taskOneHandles.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a crosshair cursor on gantt link handles', () => {
    const { container } = render(<TimelineChart />);

    const linkHandles = container.querySelectorAll('[data-gantt-link-handle="true"]');
    linkHandles.forEach((handle) => {
      expect(handle.className).toContain('cursor-crosshair');
    });
  });
});
