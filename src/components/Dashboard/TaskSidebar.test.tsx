import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskSidebar } from './TaskSidebar';
import type { DashboardItem, Task } from '../../types';

const dashboardMock = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../context/DashboardContext', () => ({
  useDashboard: dashboardMock.useDashboard,
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: Object.assign(vi.fn(), { activators: [{ handler: vi.fn(() => true) }] }),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => undefined),
    },
  },
}));

const task: Task = {
  kind: 'task',
  id: 'task-124',
  itemId: 'item-124',
  displayId: '#124',
  title: 'fix bug: the location button at the task item failed to work',
  status: 'Todo',
  startDate: '2026-06-01',
  targetDate: '2026-06-02',
  assignees: [],
  progress: 0,
  groupPath: [],
};

const dashboardItems: DashboardItem[] = [task];

describe('TaskSidebar hover actions', () => {
  const setIsCreateMode = vi.fn();
  const setSelectedTaskId = vi.fn();
  const setIsTaskDetailsOpen = vi.fn();
  const setDashboardView = vi.fn();
  const setIsChartVisible = vi.fn();
  const centerGanttOnTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    dashboardMock.useDashboard.mockReturnValue({
      filteredTasks: [task],
      dashboardItems,
      tasks: [task],
      projectFields: [],
      selectedGroupFieldIds: [],
      setSelectedGroupFieldIds: vi.fn(),
      isLoadingTasks: false,
      searchQuery: '',
      setSearchQuery: vi.fn(),
      selectedTaskId: null,
      setSelectedTaskId,
      setIsCreateMode,
      setIsChartVisible,
      setDashboardView,
      apiError: null,
      fieldsProgress: { current: 0, total: 0, isFetching: false },
      mappingStatus: 'idle',
      setIsTaskDetailsOpen,
      centerGanttOnTask,
      isLinkMode: false,
      setIsLinkMode: vi.fn(),
      selectedLinkTaskIds: [],
      setSelectedLinkTaskIds: vi.fn(),
      updateTaskSuccessors: vi.fn(),
      updateTaskGroupPath: vi.fn(),
      renameGroupBlock: vi.fn(),
      ungroupGroupBlock: vi.fn(),
      toggleGroupBlockCollapsed: vi.fn(),
      reorderTask: vi.fn(),
      reorderTaskBlock: vi.fn(),
      moveTaskToGroupPath: vi.fn(),
      setPendingTaskInsertPosition: vi.fn(),
    });
  });

  it('uses the full jump-to-chart flow from the row location button', () => {
    render(<TaskSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.centerInGantt' }));

    expect(setIsCreateMode).toHaveBeenCalledWith(false);
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-124');
    expect(setIsTaskDetailsOpen).toHaveBeenCalledWith(false);
    expect(setDashboardView).toHaveBeenCalledWith('gantt');
    expect(setIsChartVisible).toHaveBeenCalledWith(true);
    expect(centerGanttOnTask).toHaveBeenCalledWith('task-124', '2026-06-01');
  });
});
