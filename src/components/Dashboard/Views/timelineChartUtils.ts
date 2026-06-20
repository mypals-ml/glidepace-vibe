import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { diffDays } from '../../../lib/dateUtils';
import { isTaskGroupBlock } from '../../../lib/taskGroupUtils';
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

export function getGroupWeightedProgress(
  groupBlock: { childTaskIds: string[] },
  filteredTasks: Task[],
): number {
  const childTasks = filteredTasks.filter(t => groupBlock.childTaskIds.includes(t.id));
  if (childTasks.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const t of childTasks) {
    const start = getStartDateForCal(t);
    const end = getTargetDateForCal(t);
    const dur = start && end ? Math.max(diffDays(start, end), 1) : 1;
    totalWeight += dur;
    weightedSum += dur * (t.progress ?? 0);
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function getTimelineTaskBarLayout(
  task: Task,
  dayWidth: number,
  getPositionForDate: (dateStr: string) => number,
) {
  const start = getStartDateForCal(task);
  const end = getTargetDateForCal(task);
  if (!start || !end) return null;

  const left = getPositionForDate(start);
  const duration = diffDays(start, end);
  const width = duration * dayWidth;
  const minBarWidth = Math.max(48, Math.floor(dayWidth * 0.8));
  const displayWidth = Math.max(width, minBarWidth);

  return { start, end, left, displayWidth };
}

export function computeGroupRowSpans(dashboardItems: DashboardItem[]): Record<string, number> {
  const spans: Record<string, number> = {};
  for (let i = 0; i < dashboardItems.length; i++) {
    const item = dashboardItems[i];
    if (!isTaskGroupBlock(item)) continue;
    let rows = 1;
    for (let j = i + 1; j < dashboardItems.length; j++) {
      const nextItem = dashboardItems[j];
      if (!nextItem || (nextItem.depth ?? 0) <= item.depth) break;
      rows += 1;
    }
    spans[item.groupBlockId] = rows;
  }
  return spans;
}

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
