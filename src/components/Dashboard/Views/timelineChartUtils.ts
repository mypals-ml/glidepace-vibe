import { getStartDateForCal } from '../../../lib/githubTaskMapper';
import {
  getDashboardGroupDropPlan,
  getDashboardItemSortId,
  getDashboardTaskGroupPathMovePlan,
  getTaskOrderId,
  getVisibleDashboardMovePlan,
  type DashboardFieldGroupContext,
} from '../../../lib/taskOrderUtils';
import { defaultWorkCalendar } from '../../../lib/workCalendar';
import type { DashboardItem, Task } from '../../../types';

const GROUP_TITLE_LEFT_PADDING = 6;
const GROUP_TITLE_RIGHT_PADDING = 13;
const GROUP_TITLE_CHEVRON_SLOT = 31;
const GROUP_TITLE_MIN_NAME_WIDTH = 42;
const GROUP_TITLE_COUNT_MIN_WIDTH = 48;
const GROUP_TITLE_PROGRESS_WIDTH = 36;
const GROUP_TITLE_GAP = 9;

export const getGroupTitleLayout = (cardWidth: number) => {
  const innerWidth = Math.max(0, cardWidth - GROUP_TITLE_LEFT_PADDING - GROUP_TITLE_RIGHT_PADDING);
  const roomAfterRequiredName = innerWidth - GROUP_TITLE_CHEVRON_SLOT - GROUP_TITLE_MIN_NAME_WIDTH;
  const showTaskCount = roomAfterRequiredName >= GROUP_TITLE_GAP + GROUP_TITLE_COUNT_MIN_WIDTH;
  const showProgress =
    showTaskCount &&
    roomAfterRequiredName >= GROUP_TITLE_GAP + GROUP_TITLE_COUNT_MIN_WIDTH + GROUP_TITLE_GAP + GROUP_TITLE_PROGRESS_WIDTH;
  const metadataWidth =
    (showTaskCount ? GROUP_TITLE_GAP + GROUP_TITLE_COUNT_MIN_WIDTH : 0) +
    (showProgress ? GROUP_TITLE_GAP + GROUP_TITLE_PROGRESS_WIDTH : 0);
  const reservedMinWidth =
    GROUP_TITLE_CHEVRON_SLOT +
    GROUP_TITLE_MIN_NAME_WIDTH +
    metadataWidth;
  const nameMaxWidth = Math.max(0, innerWidth - GROUP_TITLE_CHEVRON_SLOT - metadataWidth);
  const countMaxWidth = showTaskCount
    ? Math.max(
      GROUP_TITLE_COUNT_MIN_WIDTH,
      GROUP_TITLE_COUNT_MIN_WIDTH + Math.max(0, innerWidth - reservedMinWidth)
    )
    : 0;

  return { showTaskCount, showProgress, nameMaxWidth, countMaxWidth };
};

const addCalendarDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return defaultWorkCalendar.formatDate(next);
};

export interface TimelineTaskBarDropPlan {
  startDate?: string;
  groupDropPlan?: ReturnType<typeof getDashboardGroupDropPlan>;
  taskGroupPathMovePlan?: ReturnType<typeof getDashboardTaskGroupPathMovePlan>;
  movePlan?: ReturnType<typeof getVisibleDashboardMovePlan>;
}

export function buildTimelineTaskBarDropPlan({
  task,
  dashboardItems,
  orderedTasks,
  overRowIndex,
  deltaDays,
  fieldGroupContext,
}: {
  task: Task;
  dashboardItems: DashboardItem[];
  orderedTasks: Task[];
  overRowIndex: number;
  deltaDays: number;
  fieldGroupContext: DashboardFieldGroupContext;
}): TimelineTaskBarDropPlan {
  const activeSortId = `task:${getTaskOrderId(task)}` as const;
  const overItem = dashboardItems[overRowIndex];
  const overSortId = overItem ? getDashboardItemSortId(overItem) : null;
  const start = getStartDateForCal(task);
  const startDate = start && deltaDays !== 0 ? addCalendarDays(start, deltaDays) : undefined;

  if (!overSortId || overSortId === activeSortId) return { startDate };

  const groupDropPlan = getDashboardGroupDropPlan(
    dashboardItems,
    activeSortId,
    overSortId,
    orderedTasks,
    fieldGroupContext
  );
  if (groupDropPlan) return { startDate, groupDropPlan };

  const taskGroupPathMovePlan = getDashboardTaskGroupPathMovePlan(
    dashboardItems,
    activeSortId,
    overSortId,
    orderedTasks,
    fieldGroupContext
  );
  if (taskGroupPathMovePlan) return { startDate, taskGroupPathMovePlan };

  return {
    startDate,
    movePlan: getVisibleDashboardMovePlan(dashboardItems, activeSortId, overSortId, orderedTasks),
  };
}
