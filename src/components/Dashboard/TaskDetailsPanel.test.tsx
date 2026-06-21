import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  contentId: 'issue-125',
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
  const fetchTaskComments = vi.fn();
  const fetchSingleProjectItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchTaskComments.mockResolvedValue(undefined);
    fetchSingleProjectItem.mockResolvedValue(undefined);

    dashboardMock.useDashboard.mockReturnValue({
      isCreateMode: false,
      setIsCreateMode,
      centerGanttOnTask: vi.fn(),
      setIsChartVisible: vi.fn(),
      setDashboardView: vi.fn(),
      setPendingTaskInsertPosition,
      fetchTaskComments,
      isFetchingComments: {},
      fetchSingleProjectItem,
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

  it('offsets the mobile overlay below the app header so the close action stays reachable', () => {
    const { container } = render(<TaskDetailsPanel task={task} onClose={vi.fn()} isInline={false} />);

    const panel = container.querySelector('.top-\\[var\\(--app-header-height\\)\\]');
    expect(panel).toBeTruthy();
    expect(panel?.className).toContain('fixed');
    expect(panel?.className).not.toContain('inset-0');
  });

  it('opens task details without refetching the selected project item', async () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(fetchTaskComments).toHaveBeenCalled();
    });
    expect(fetchSingleProjectItem).not.toHaveBeenCalled();
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

  it('renders the Task actions section at the end of the view, after the comments section', () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    // The panel renders the content twice (mobile and desktop layouts); check the first copy.
    const taskActionsLabel = screen.getAllByText('Task actions')[0];
    const commentsLabel = screen.getAllByText('dashboard.comments')[0];
    const descriptionLabel = screen.getAllByText('dashboard.description')[0];
    const statusLabel = screen.getAllByText('table.status')[0];

    const follows = (earlier: HTMLElement, later: HTMLElement) =>
      Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(descriptionLabel, taskActionsLabel)).toBe(true);
    expect(follows(statusLabel, taskActionsLabel)).toBe(true);
    expect(follows(commentsLabel, taskActionsLabel)).toBe(true);
  });

  it('renders the Delete Task action inside the Task actions section', () => {
    render(<TaskDetailsPanel task={task} onClose={vi.fn()} />);

    const taskActionsLabel = screen.getAllByText('Task actions')[0];
    const taskActionsCard = taskActionsLabel.parentElement?.parentElement as HTMLElement;

    const deleteButton = within(taskActionsCard).getByRole('button', { name: /Delete Task/ });
    expect(deleteButton.tagName).toBe('BUTTON');
    // The other task actions live in the same card as the delete action.
    expect(within(taskActionsCard).getByRole('button', { name: /dashboard.addTaskAbove/ }).tagName).toBe('BUTTON');
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

  it('shows persisted GitHub dates before dependency temp dates in details', () => {
    const taskWithTempDates: Task = {
      ...task,
      startDate: '2026-06-02',
      targetDate: '2026-06-03',
      tempStartDate: '2026-06-10',
      tempTargetDate: '2026-06-11',
    };
    const { container } = render(<TaskDetailsPanel task={taskWithTempDates} onClose={vi.fn()} />);

    const dateInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));

    expect(dateInputs[0].value).toBe('2026-06-02');
    expect(dateInputs[1].value).toBe('2026-06-03');
  });
});
