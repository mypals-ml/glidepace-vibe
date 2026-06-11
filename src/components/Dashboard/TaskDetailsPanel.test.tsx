import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import type { Task } from '../../types';

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
      t: (key: string, fallback?: string | Record<string, unknown>) => typeof fallback === 'string' ? fallback : key,
    }),
  };
});

const predecessorTask: Task = {
  kind: 'task',
  id: 'task-predecessor',
  itemId: 'item-predecessor',
  displayId: '#124',
  title: 'Predecessor',
  status: 'Todo',
  startDate: '2026-06-01',
  targetDate: '2026-06-01',
  assignees: [],
  progress: 0,
  successorIds: ['item-125'],
};

const task: Task = {
  kind: 'task',
  id: 'task-125',
  itemId: 'item-125',
  displayId: '#125',
  title: 'Refine the task details view: action buttons',
  status: 'Todo',
  startDate: '2026-06-02',
  targetDate: '2026-06-02',
  assignees: [],
  progress: 0,
  groupPath: ['Planning'],
  successorIds: ['item-successor'],
};

describe('TaskDetailsPanel actions', () => {
  const setIsCreateMode = vi.fn();
  const setSelectedTaskId = vi.fn();
  const setIsTaskDetailsOpen = vi.fn();
  const setPendingTaskInsertPosition = vi.fn();
  const setIsLinkMode = vi.fn();
  const setSelectedLinkTaskIds = vi.fn();
  const updateTaskSuccessors = vi.fn();
  const updateTaskGroupPath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    dashboardMock.useDashboard.mockReturnValue({
      isCreateMode: false,
      setIsCreateMode,
      centerGanttOnTask: vi.fn(),
      setIsChartVisible: vi.fn(),
      setDashboardView: vi.fn(),
      setPendingTaskInsertPosition,
      fetchTaskComments: vi.fn().mockResolvedValue(undefined),
      isFetchingComments: {},
      fetchSingleProjectItem: vi.fn().mockResolvedValue(undefined),
      githubToken: 'mock-token',
      updateTaskTitle: vi.fn(),
      updateTaskDescription: vi.fn(),
      updateTaskComment: vi.fn(),
      deleteTaskComment: vi.fn(),
      updateTaskDates: vi.fn(),
      addTaskComment: vi.fn(),
      deleteTask: vi.fn(),
      handleCreateTask: vi.fn(),
      tasks: [predecessorTask, task],
      projectStatusOptions: ['Todo', 'In progress'],
      setIsTaskDetailsOpen,
      setSelectedTaskId,
      showToast: vi.fn(),
      dateSettings: { estimateUnit: 'hours' },
      projectFields: [],
      pendingTaskInsertPosition: null,
      setIsLinkMode,
      setSelectedLinkTaskIds,
      updateTaskSuccessors,
      updateTaskGroupPath,
    });
  });

  it('starts positioned task creation from the details panel', () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /dashboard.addTaskAbove/ })[0]);

    expect(setPendingTaskInsertPosition).toHaveBeenCalledWith({ targetTaskId: 'task-125', placement: 'above' });
    expect(setIsCreateMode).toHaveBeenCalledWith(true);
    expect(setSelectedTaskId).toHaveBeenCalledWith(null);
    expect(setIsTaskDetailsOpen).toHaveBeenCalledWith(true);
  });

  it('starts successor link mode from the details panel', () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /dashboard.addSuccessors/ })[0]);

    expect(setIsLinkMode).toHaveBeenCalledWith(true);
    expect(setSelectedLinkTaskIds).toHaveBeenCalledWith(['task-125']);
    expect(setIsTaskDetailsOpen).toHaveBeenCalledWith(false);
  });

  it('breaks all task links from the details panel', async () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /dashboard.breakAllLinks/ })[0]);

    await waitFor(() => {
      expect(updateTaskSuccessors).toHaveBeenCalledWith('item-predecessor', [], true);
      expect(updateTaskSuccessors).toHaveBeenCalledWith('item-125', [], true);
    });
  });

  it('updates the task group path from the details panel', async () => {
    updateTaskGroupPath.mockResolvedValue(true);
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /dashboard.groupLabel/ })[0]);
    fireEvent.change(screen.getByLabelText(/Group Path/), {
      target: { value: 'Planning / UI' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(updateTaskGroupPath).toHaveBeenCalledWith('task-125', ['Planning', 'UI']);
    });
  });
});
