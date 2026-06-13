import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { getStatusColor } from '../../../utils/statusColors';
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { diffDays } from '../../../lib/dateUtils';
import { IconButton } from '../../UI/IconButton';
import { useGanttTimeline } from '../../../hooks/useGanttTimeline';
import { DependencyLines } from './DependencyLines';
import { FloatingSequenceBuilder } from '../FloatingSequenceBuilder';
import { isTaskGroupBlock } from '../../../lib/taskGroupUtils';
import { defaultWorkCalendar } from '../../../lib/workCalendar';
import { getScrollTopForSelectedRow } from '../../../lib/scrollUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../../lib/contextMenuLinkUtils';
import { getTreeColor, getGroupCardTitleBg, getGroupCardContentBg, getGroupCardBorder, getGroupCardPillBg, getGroupCardTitleFg } from '../../../lib/treeColors';
import type { DashboardFieldGroupContext } from '../../../lib/taskOrderUtils';
import { buildGanttTaskBarDropPlan, getGroupTitleLayout, type GanttTaskBarDropPlan } from './ganttChartUtils';
import type { Task } from '../../../types';

export interface GanttChartProps {
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const BASE_DAY_WIDTH = 120;
const INITIAL_BUFFER_DAYS_LEFT = 14;
const INITIAL_BUFFER_DAYS_RIGHT = 30;
const EXPANSION_THRESHOLD_PX = 300;
const EXPANSION_DAYS = 14;
const ROW_HEIGHT = 72;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1;
const TASK_BAR_DRAG_THRESHOLD_PX = 6;

const getViewportInfo = (el: HTMLDivElement) => ({
  scrollLeft: el.scrollLeft,
  scrollTop: el.scrollTop,
  clientWidth: el.clientWidth,
  clientHeight: el.clientHeight,
});

const GROUP_CARD_PAD = 9;
const GROUP_CARD_TITLE_HEIGHT = 40;
const GROUP_CARD_RADIUS = 8;
const GROUP_TITLE_LEFT_PADDING = 6;
const GROUP_TITLE_RIGHT_PADDING = 13;
const GROUP_TITLE_PROGRESS_WIDTH = 36;

export function GanttChart({ className = '', scrollRef, onScroll }: GanttChartProps) {
  const { t } = useTranslation();
  const { tasks, filteredTasks, dashboardItems, selectedGroupFieldIds, projectFields, isLoadingTasks, requestedCenterDate, requestedCenterTaskId, centerGanttOnDate, completeGanttCenterRequest, selectedTaskId, setSelectedTaskId, setIsTaskDetailsOpen, updateTaskDates, updateTaskSuccessors, isLinkMode, setIsLinkMode, selectedLinkTaskIds, setSelectedLinkTaskIds, toggleGroupBlockCollapsed, reorderTask, reorderTaskBlock, moveTaskToGroupPath, ganttZoomPercent, setGanttZoomPercent } = useDashboard();
  const [viewportInfo, setViewportInfo] = useState({ scrollLeft: 0, scrollTop: 0, clientWidth: 0, clientHeight: 0 });
  const [taskBarDragState, setTaskBarDragState] = useState<{
    taskId: string;
    pointerId: number;
    originClientX: number;
    originClientY: number;
    originRowIndex: number;
    deltaX: number;
    deltaY: number;
    hasMoved: boolean;
  } | null>(null);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  
  // Use either the provided ref or internal one
  const activeScrollRef = scrollRef || internalScrollRef;

  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (ganttZoomPercent ?? 100) / 100));
  const dayWidth = Math.round(BASE_DAY_WIDTH * zoom);

  const prevDayWidthRef = useRef(dayWidth);

  // Live value refs for native event handlers (wheel/pinch) so we always have fresh numbers
  // without stale closures. Also used for focal-point zoom calculations.
  const dayWidthRef = useRef(dayWidth);
  const zoomPercentRef = useRef(ganttZoomPercent);
  const lastPinchDistRef = useRef<number | null>(null);
  const pinchAnchorDayIndexRef = useRef<number | null>(null);
  const pendingDesiredScrollRef = useRef<number | null>(null);

  useEffect(() => {
    dayWidthRef.current = dayWidth;
    zoomPercentRef.current = ganttZoomPercent;
  }, [dayWidth, ganttZoomPercent]);

  const { 
    timelineRange, 
    timelineExpansionVersion,
    getPositionForDate, 
    handleScroll: handleTimelineScroll,
    centerOnDate 
  } = useGanttTimeline({
    dayWidth,
    initialBufferDaysLeft: INITIAL_BUFFER_DAYS_LEFT,
    initialBufferDaysRight: INITIAL_BUFFER_DAYS_RIGHT,
    expansionThresholdPx: EXPANSION_THRESHOLD_PX,
    expansionDays: EXPANSION_DAYS,
    scrollRef: activeScrollRef
  });

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => defaultWorkCalendar.formatDate(today), [today]);
  const fieldGroupContext = useMemo<DashboardFieldGroupContext>(() => ({
    fieldIds: selectedGroupFieldIds,
    fields: projectFields,
  }), [selectedGroupFieldIds, projectFields]);

  // Weighted progress for a group block (Design 7 group card): weight each
  // child task's progress by its duration in days, matching the design's
  // `weighted(g)` derivation.
  const getGroupWeightedProgress = (groupBlock: { childTaskIds: string[] }): number => {
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
  };

  // Design 7: a group is drawn as a CARD that wraps its title row AND every
  // descendant row beneath it. Precompute, per group block, how many rows
  // (the title row itself + all descendant rows) the card must span. Items in
  // `dashboardItems` are flat and ordered: a group is immediately followed by
  // its descendants; a descendant has `depth` greater than the group's depth.
  const groupRowSpans = useMemo(() => {
    const spans: Record<string, number> = {};
    for (let i = 0; i < dashboardItems.length; i++) {
      const item = dashboardItems[i];
      if (!isTaskGroupBlock(item)) continue;
      let rows = 1; // the title row itself
      for (let j = i + 1; j < dashboardItems.length; j++) {
        const nextItem = dashboardItems[j];
        if (!nextItem || (nextItem.depth ?? 0) <= item.depth) break;
        rows += 1;
      }
      spans[item.groupBlockId] = rows;
    }
    return spans;
  }, [dashboardItems]);

  // Update viewport info on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setViewportInfo(getViewportInfo(e.currentTarget));
    
    // Delegate to timeline hook for expansion logic
    handleTimelineScroll(e);

    if (onScroll) onScroll(e);
  };

  // Handle external scroll requests (e.g. from Sidebar)
  const [linkDragState, setLinkDragState] = useState<{ sourceTaskId: string; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [hoveredTargetTaskId, setHoveredTargetTaskId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);
  const didCenterInitialRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openContextMenu = (clientX: number, clientY: number, taskId: string, anchor: HTMLElement) => {
    const rect = anchor.closest('main')?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: clientX - rect.left,
        y: clientY - rect.top,
        taskId
      });
    }
  };

  const handleBreakLink = async (sourceId: string, targetId: string) => {
    const sourceTask = filteredTasks.find(t => t.id === sourceId);
    if (!sourceTask || !sourceTask.successorIds) return;
    const newSuccessors = sourceTask.successorIds.filter(id => id !== targetId);
    await updateTaskSuccessors(sourceId, newSuccessors);
  };

  const contextBreakLinkPlan = useMemo(() => {
    if (!contextMenu) return null;
    const task = tasks.find(task => task.id === contextMenu.taskId || task.itemId === contextMenu.taskId);
    return task ? buildBreakLinkPlan(tasks, { firstTask: task, lastTask: task }, 'all') : null;
  }, [contextMenu, tasks]);

  const handleBreakLinksFromContext = async (taskId: string, scope: BreakLinkScope) => {
    const task = tasks.find(task => task.id === taskId || task.itemId === taskId);
    if (!task) return;

    const plan = buildBreakLinkPlan(tasks, { firstTask: task, lastTask: task }, scope);
    for (const operation of plan.operations) {
      await updateTaskSuccessors(operation.taskId, operation.successorIds, true);
    }

    setContextMenu(null);
  };

  const handleLinkDragStart = (e: React.MouseEvent, taskId: string, startX: number, startY: number) => {
    e.stopPropagation();
    e.preventDefault();
    setHoveredTargetTaskId(null);
    setLinkDragState({ sourceTaskId: taskId, startX, startY, currentX: startX, currentY: startY });
  };

  const handleLinkDragMove = (e: React.MouseEvent) => {
    if (!linkDragState || !activeScrollRef.current) return;
    const rect = activeScrollRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + activeScrollRef.current.scrollLeft;
    const currentY = e.clientY - rect.top + activeScrollRef.current.scrollTop;
    setLinkDragState(prev => prev ? { ...prev, currentX, currentY } : null);
  };

  const handleLinkDragEnd = () => {
    setLinkDragState(null);
    setHoveredTargetTaskId(null);
  };

  const handleLinkDrop = async (targetTaskId: string) => {
    if (!linkDragState) return;
    const sourceTaskId = linkDragState.sourceTaskId;
    setLinkDragState(null);
    setHoveredTargetTaskId(null);
    if (sourceTaskId === targetTaskId) return;

    const sourceTask = filteredTasks.find(t => t.id === sourceTaskId);
    const targetTask = filteredTasks.find(t => t.id === targetTaskId);

    if (sourceTask && targetTask && targetTask.itemId) {
      const currentSuccessors = sourceTask.successorIds || [];
      if (!currentSuccessors.includes(targetTask.itemId)) {
        await updateTaskSuccessors(sourceTaskId, [...currentSuccessors, targetTask.itemId]);
      }
    }
  };

  const handleTaskActivate = (taskId: string) => {
    if (isLinkMode) {
      setSelectedLinkTaskIds(prev =>
        prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
      return;
    }

    setSelectedTaskId(taskId);
    setIsTaskDetailsOpen(true);
  };

  const handleTaskBarPointerDown = (e: React.PointerEvent<HTMLDivElement>, task: Task, rowIndex: number) => {
    if (isLinkMode || e.button !== 0 || e.pointerType !== 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-gantt-link-handle="true"]')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setContextMenu(null);
    setTaskBarDragState({
      taskId: task.id,
      pointerId: e.pointerId,
      originClientX: e.clientX,
      originClientY: e.clientY,
      originRowIndex: rowIndex,
      deltaX: 0,
      deltaY: 0,
      hasMoved: false,
    });
  };

  const handleTaskBarPointerMove = (e: React.PointerEvent<HTMLDivElement>, taskId: string) => {
    setTaskBarDragState(prev => {
      if (!prev || prev.taskId !== taskId || prev.pointerId !== e.pointerId) return prev;
      const deltaX = e.clientX - prev.originClientX;
      const deltaY = e.clientY - prev.originClientY;
      const hasMoved = prev.hasMoved || Math.hypot(deltaX, deltaY) >= TASK_BAR_DRAG_THRESHOLD_PX;
      if (hasMoved) clearLongPressTimer();
      return { ...prev, deltaX, deltaY, hasMoved };
    });
  };

  const applyTaskBarDropPlan = async (task: Task, plan: GanttTaskBarDropPlan) => {
    if (plan.startDate) {
      await updateTaskDates(task, plan.startDate);
    }

    if (plan.groupDropPlan) {
      await moveTaskToGroupPath(
        plan.groupDropPlan.taskId,
        plan.groupDropPlan.targetGroupPath,
        plan.groupDropPlan.afterTaskId,
        plan.groupDropPlan.fieldValueChanges
      );
      return;
    }

    if (plan.taskGroupPathMovePlan) {
      await moveTaskToGroupPath(
        plan.taskGroupPathMovePlan.taskId,
        plan.taskGroupPathMovePlan.targetGroupPath,
        plan.taskGroupPathMovePlan.afterTaskId,
        plan.taskGroupPathMovePlan.fieldValueChanges
      );
      return;
    }

    if (!plan.movePlan) return;
    if (plan.movePlan.taskIds.length === 1) {
      await reorderTask(plan.movePlan.taskIds[0], plan.movePlan.afterTaskId);
    } else {
      await reorderTaskBlock(plan.movePlan.taskIds, plan.movePlan.afterTaskId);
    }
  };

  const handleTaskBarPointerEnd = async (e: React.PointerEvent<HTMLDivElement>, task: Task) => {
    const dragState = taskBarDragState;
    if (!dragState || dragState.taskId !== task.id || dragState.pointerId !== e.pointerId) return;

    setTaskBarDragState(null);
    if (!dragState.hasMoved) return;

    suppressNextClickRef.current = true;
    const deltaDays = Math.round(dragState.deltaX / dayWidth);
    const overRowIndex = Math.max(
      0,
      Math.min(
        dashboardItems.length - 1,
        Math.floor((dragState.originRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2 + dragState.deltaY) / ROW_HEIGHT)
      )
    );
    const plan = buildGanttTaskBarDropPlan({
      task,
      dashboardItems,
      orderedTasks: tasks,
      overRowIndex,
      deltaDays,
      fieldGroupContext,
    });

    await applyTaskBarDropPlan(task, plan);
  };

  // Handle initial centering
  useEffect(() => {
    if (didCenterInitialRef.current) return;

    if (activeScrollRef.current) {
      didCenterInitialRef.current = true;
      centerOnDate(todayStr, 'auto');
      setViewportInfo(getViewportInfo(activeScrollRef.current));
    }
  }, [activeScrollRef, todayStr, centerOnDate]);

  // Handle explicit focus requests (e.g. from Sidebar / Task Details)
  useLayoutEffect(() => {
    if (!requestedCenterDate && !requestedCenterTaskId) return;

    if (requestedCenterDate) {
      const didCenterDate = centerOnDate(requestedCenterDate, 'smooth');
      if (!didCenterDate) return;
    }

    if (!requestedCenterTaskId) {
      completeGanttCenterRequest();
      return;
    }

    if (!activeScrollRef.current) return;

    const selectedIndex = dashboardItems.findIndex(item => !isTaskGroupBlock(item) && item.id === requestedCenterTaskId);
    if (selectedIndex < 0) return;

    const top = getScrollTopForSelectedRow({
      currentScrollTop: activeScrollRef.current.scrollTop,
      rowIndex: selectedIndex,
      rowHeight: ROW_HEIGHT,
      viewportHeight: activeScrollRef.current.clientHeight,
    });
    activeScrollRef.current.scrollTop = top;
    completeGanttCenterRequest();
  }, [requestedCenterDate, requestedCenterTaskId, activeScrollRef, centerOnDate, completeGanttCenterRequest, dashboardItems, timelineExpansionVersion]);

  // Re-anchor scroll when zoom (dayWidth) changes so the same date stays near viewport center.
  // Also applies any pending focal scroll from live gestures *after* the new bar styles have committed,
  // to avoid a paint frame with new scroll + old left/width on the task bars.
  useLayoutEffect(() => {
    const el = activeScrollRef.current;
    if (!el) {
      prevDayWidthRef.current = dayWidth;
      return;
    }

    if (pendingDesiredScrollRef.current != null) {
      const desired = pendingDesiredScrollRef.current;
      if (Math.abs(el.scrollLeft - desired) > 0.5) {
        el.scrollLeft = desired;
        setViewportInfo(getViewportInfo(el));
      }
      pendingDesiredScrollRef.current = null;
    } else if (prevDayWidthRef.current !== dayWidth) {
      const prev = prevDayWidthRef.current;
      const next = dayWidth;
      const centerX = el.scrollLeft + el.clientWidth / 2;
      const dayIndex = centerX / prev;
      const newCenterX = dayIndex * next;
      const desiredScrollLeft = Math.max(0, newCenterX - el.clientWidth / 2);
      el.scrollLeft = desiredScrollLeft;
      setViewportInfo(getViewportInfo(el));
    }
    prevDayWidthRef.current = dayWidth;
  }, [dayWidth, activeScrollRef]);

  // Native listeners for Ctrl/Cmd + wheel zoom and two-finger pinch-to-zoom.
  // These use passive:false so we can preventDefault and stop the browser's own page zoom.
  // We compute focal point and keep the logical date under that point stable (zoom-to-cursor / zoom-to-pinch-center).
  // We use optimistic setViewportInfo + pendingDesiredScrollRef (applied in useLayoutEffect after styles commit)
  // to avoid mismatched paint frames during zoom. We still update prevDayWidthRef to suppress center-reanchor for gestures.
  useEffect(() => {
    const el = activeScrollRef.current;
    if (!el) return;

    const getTouchDist = (touches: TouchList) => {
      const t0 = touches[0];
      const t1 = touches[1];
      return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    };

    const handleWheelNative = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const focalViewportX = e.clientX - rect.left;
      const focalContentX = el.scrollLeft + focalViewportX;

      const currDW = dayWidthRef.current || 120;
      const anchorDay = currDW > 0 ? focalContentX / currDW : 0;

      const currP = zoomPercentRef.current;
      const delta = e.deltaY < 0 ? 5 : -5;
      const newP = Math.max(50, Math.min(100, currP + delta));
      const newDW = Math.round(BASE_DAY_WIDTH * (newP / 100));

      const newContentFocal = anchorDay * newDW;
      const desiredScroll = Math.max(0, newContentFocal - focalViewportX);

      // Optimistic viewport update so render uses the target scroll (for header translate + grid vis).
      // The actual scrollLeft adjustment happens in the dayWidth useLayoutEffect *after* new bar styles commit.
      setViewportInfo({ ...getViewportInfo(el), scrollLeft: desiredScroll });

      setGanttZoomPercent(newP);
      prevDayWidthRef.current = newDW;
      pendingDesiredScrollRef.current = desiredScroll;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastPinchDistRef.current = getTouchDist(e.touches);

        const rect = el.getBoundingClientRect();
        const midClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const focalViewportX = midClientX - rect.left;
        const focalContentX = el.scrollLeft + focalViewportX;
        const currDW = dayWidthRef.current || BASE_DAY_WIDTH;
        pinchAnchorDayIndexRef.current = currDW > 0 ? focalContentX / currDW : 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistRef.current != null && pinchAnchorDayIndexRef.current != null) {
        e.preventDefault();

        const dist = getTouchDist(e.touches);
        const ratio = lastPinchDistRef.current > 0 ? dist / lastPinchDistRef.current : 1;
        lastPinchDistRef.current = dist;

        const currZoom = zoomPercentRef.current / 100;
        let nextZoom = currZoom * ratio;
        nextZoom = Math.max(0.5, Math.min(1, nextZoom));

        const newP = Math.round(nextZoom * 100);
        const newDW = Math.round(BASE_DAY_WIDTH * nextZoom);

        const rect = el.getBoundingClientRect();
        const midClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const focalViewportX = midClientX - rect.left;
        const targetContentX = pinchAnchorDayIndexRef.current * newDW;

        const desiredScroll = Math.max(0, targetContentX - focalViewportX);

        // Optimistic viewport update so render uses the target scroll.
        // Actual scroll adjustment in layout effect after styles commit.
        setViewportInfo({ ...getViewportInfo(el), scrollLeft: desiredScroll });

        setGanttZoomPercent(newP);
        prevDayWidthRef.current = newDW;
        pendingDesiredScrollRef.current = desiredScroll;
      }
    };

    const handleTouchEndOrCancel = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastPinchDistRef.current = null;
        pinchAnchorDayIndexRef.current = null;
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEndOrCancel);
    el.addEventListener('touchcancel', handleTouchEndOrCancel);

    return () => {
      el.removeEventListener('wheel', handleWheelNative);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEndOrCancel);
      el.removeEventListener('touchcancel', handleTouchEndOrCancel);
    };
  }, [activeScrollRef, setGanttZoomPercent]);

  // Vertical Virtualization: Calculate visible days
  const visibleStartIndex = Math.max(0, Math.floor(viewportInfo.scrollLeft / dayWidth) - 2);
  const visibleEndIndex = Math.min(timelineRange.totalDays, Math.ceil((viewportInfo.scrollLeft + viewportInfo.clientWidth) / dayWidth) + 2);

  const visibleTimelineDays = useMemo(() => {
    const days = [];
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const d = new Date(timelineRange.start);
      d.setDate(d.getDate() + i);
      const dateStr = defaultWorkCalendar.formatDate(d);
      const isToday = dateStr === todayStr;
      const isNonWorkday = defaultWorkCalendar.isNonWorkday(dateStr);
      
      days.push({
        date: dateStr,
        label: t(`days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]}`),
        dayNum: d.getDate(),
        month: d.toLocaleString('default', { month: 'short' }),
        isToday,
        isNonWorkday,
        index: i
      });
    }
    return days;
  }, [timelineRange, visibleStartIndex, visibleEndIndex, todayStr, t]);

  const todayPos = getPositionForDate(todayStr);
  const isTodayInViewport = todayPos >= viewportInfo.scrollLeft && todayPos <= (viewportInfo.scrollLeft + viewportInfo.clientWidth);
  const todayDirection = todayPos < viewportInfo.scrollLeft ? 'left' : todayPos > (viewportInfo.scrollLeft + viewportInfo.clientWidth) ? 'right' : 'visible';

  return (
    <main className={`flex-1 flex-col overflow-hidden relative z-10 glass-panel md:rounded-r-xl bg-white/80 shadow-sm border md:border-y md:border-r border-slate-200/60 ${className}`} aria-label="Timeline View" role="region">
      {/* Header with Sticky Dates */}
      <div className="h-[var(--dashboard-header-height)] border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex sticky top-0 z-20 overflow-hidden" aria-hidden="true">
        <div 
          className="flex text-[10px] font-bold text-slate-500 select-none uppercase tracking-wider relative"
          style={{ 
            width: `${timelineRange.totalDays * dayWidth}px`,
            transform: `translateX(-${viewportInfo.scrollLeft}px)`
          }}
        >
          {visibleTimelineDays.map((day) => (
            <div 
              key={day.date} 
              className={`flex-shrink-0 border-r border-slate-100 flex flex-col justify-center items-center gap-px absolute top-0 bottom-0 ${day.isNonWorkday ? 'bg-slate-200/70 text-slate-500' : ''} ${day.isToday ? '!bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500/35' : ''}`}
              style={{ 
                width: `${dayWidth}px`,
                left: `${day.index * dayWidth}px`
              }}
            >
              <span className={day.isToday ? 'rounded-full bg-indigo-600 px-1.5 py-0 text-[9px] leading-[10px] font-black text-white shadow-sm' : 'opacity-60'}>
                {day.month} {day.dayNum}
              </span>
              <span className={day.isToday ? 'text-[10px] leading-3 font-extrabold' : 'text-[11px] font-extrabold'}>
                {day.label}
              </span>
            </div>
          ))}
        </div>

        {/* Go to Today Button */}
        {!isTodayInViewport && (
          <div className={`absolute top-1/2 -translate-y-1/2 z-30 transition-all duration-300 ${todayDirection === 'left' ? 'left-0' : 'right-0'}`}>
            <IconButton
              icon={todayDirection === 'left' ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}
              variant="primary"
              size="sm"
              onClick={() => centerGanttOnDate(todayStr)}
              aria-label={t('dashboard.goToToday') || 'Go to Today'}
              title={t('dashboard.goToToday') || 'Go to Today'}
              className="!bg-transparent !text-primary hover:!bg-primary/10 !shadow-none !border-none !rounded-none !outline-none focus:!ring-0 focus:!ring-offset-0"
            />
          </div>
        )}
      </div>

      <div 
        className={`flex-1 overflow-auto relative custom-scrollbar bg-white/40 ${linkDragState ? 'cursor-grabbing' : ''}`} 
        ref={activeScrollRef} 
        onScroll={handleScroll}
        onMouseMove={handleLinkDragMove}
        onMouseUp={handleLinkDragEnd}
        onMouseLeave={handleLinkDragEnd}
      >
        <div className="relative pb-[var(--search-bar-height)]" style={{ width: `${timelineRange.totalDays * dayWidth}px`, minHeight: '100%' }}>
          {/* Background Grid */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {visibleTimelineDays.map((day) => (
              <div 
                key={day.date} 
                className={`flex-shrink-0 border-r border-slate-100/50 absolute top-0 bottom-0 ${day.isNonWorkday ? 'bg-slate-200/45' : ''} ${day.isToday && !day.isNonWorkday ? 'bg-indigo-50/20' : ''}`}
                style={{ 
                  width: `${dayWidth}px`,
                  left: `${day.index * dayWidth}px`
                }}
              />
            ))}
          </div>
          
          {/* Horizontal lines */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(to bottom, transparent 71px, rgba(226, 232, 240, 0.4) 72px)', backgroundSize: '100% 72px' }}></div>

          {isLoadingTasks ? (
            <div className="sticky left-0 right-0 h-full flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
                <span className="text-sm font-bold text-slate-500">{t('dashboard.loadingTasks')}</span>
              </div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="sticky left-0 right-0 h-full flex items-center justify-center text-slate-400 text-sm italic">
              {t('dashboard.noMatchingTasks')}
            </div>
          ) : (
            <div className="relative z-10">
              <DependencyLines
                items={dashboardItems}
                tasks={filteredTasks}
                getPositionForDate={getPositionForDate}
                dayWidth={dayWidth} 
                onBreakLink={handleBreakLink}
                dragState={linkDragState}
                hoveredTargetTaskId={hoveredTargetTaskId}
                viewportInfo={viewportInfo}
              />
              {dashboardItems.map((item, index) => {
                if (isTaskGroupBlock(item)) {
                  const groupStart = item.startDate;
                  const groupEnd = item.targetDate;

                  // Color keyed to the tree-view node color for this group's depth,
                  // so the card matches the group's node in the task list.
                  const nodeColor = getTreeColor(item.depth);
                  const titleBg = getGroupCardTitleBg(item.depth);
                  const contentBg = getGroupCardContentBg(item.depth);
                  const cardBorder = getGroupCardBorder(item.depth);
                  const titleFg = getGroupCardTitleFg(item.depth);

                  // No-date fallback: keep a sticky label (Design 7 has no card to draw without a span).
                  if (!groupStart || !groupEnd) {
                    return (
                      <div key={item.groupBlockId} className="relative h-[72px] w-full flex items-center px-2 bg-slate-50/40">
                        <button
                          type="button"
                          onClick={() => toggleGroupBlockCollapsed(item.groupBlockId)}
                          className="sticky left-3 inline-flex items-center gap-2 text-sm font-extrabold tracking-[-0.01em]"
                          style={{ color: titleFg }}
                        >
                          <span
                            className="material-symbols-outlined text-[18px] transition-transform duration-200"
                            style={{ transform: item.isExpanded ? 'rotate(90deg)' : 'none', color: nodeColor }}
                          >
                            chevron_right
                          </span>
                          {item.name}
                        </button>
                      </div>
                    );
                  }

                  // ---- Design 7: "group as a card". ----
                  // The card surface wraps the title row AND every descendant
                  // row; the group bar is the card's title row sitting at the top.
                  const spanLeft = getPositionForDate(groupStart);
                  const duration = diffDays(groupStart, groupEnd);
                  const spanWidth = duration * dayWidth;
                  const cardLeft = spanLeft - GROUP_CARD_PAD;
                  const groupMinWidth = Math.max(80, Math.floor(dayWidth));
                  const cardWidth = Math.max(spanWidth, groupMinWidth) + GROUP_CARD_PAD * 2;
                  const weightedProgress = getGroupWeightedProgress(item);
                  const isOpen = item.isExpanded;
                  const rowSpan = groupRowSpans[item.groupBlockId] ?? 1;
                  const titleLayout = getGroupTitleLayout(cardWidth);
                  // Card height: own row + descendant rows when expanded, else just the title row.
                  const cardHeight = isOpen
                    ? (rowSpan - 1) * ROW_HEIGHT + GROUP_CARD_TITLE_HEIGHT + (72 - GROUP_CARD_TITLE_HEIGHT) / 2
                    : GROUP_CARD_TITLE_HEIGHT;
                  const titleTop = (72 - GROUP_CARD_TITLE_HEIGHT) / 2;

                  return (
                    <div key={item.groupBlockId} className="relative h-[72px] w-full px-2" style={{ zIndex: 5 }}>
                      {/* translucent card surface — wraps title row + child rows (more transparent than the title) */}
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${cardLeft}px`,
                          width: `${cardWidth}px`,
                          top: `${titleTop}px`,
                          height: `${cardHeight}px`,
                          background: contentBg,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: `${GROUP_CARD_RADIUS}px`,
                          zIndex: 0,
                        }}
                      />
                      {/* group bar == card title row */}
                      <button
                        type="button"
                        onClick={() => toggleGroupBlockCollapsed(item.groupBlockId)}
                        className="absolute flex items-center gap-[9px] text-left overflow-hidden"
                        style={{
                          left: `${cardLeft}px`,
                          width: `${cardWidth}px`,
                          top: `${titleTop}px`,
                          height: `${GROUP_CARD_TITLE_HEIGHT}px`,
                          padding: `0 ${GROUP_TITLE_RIGHT_PADDING}px 0 ${GROUP_TITLE_LEFT_PADDING}px`,
                          background: titleBg,
                          borderRadius: isOpen
                            ? `${GROUP_CARD_RADIUS}px ${GROUP_CARD_RADIUS}px 0 0`
                            : `${GROUP_CARD_RADIUS}px`,
                          borderBottom: isOpen ? `1px solid ${cardBorder}` : 'none',
                          zIndex: 5,
                        }}
                        aria-expanded={isOpen}
                      >
                        <span
                          className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md flex-shrink-0 transition-colors"
                          style={{ color: nodeColor }}
                        >
                          <span
                            className="material-symbols-outlined text-[18px] transition-transform duration-200"
                            style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                          >
                            chevron_right
                          </span>
                        </span>
                        <span className="text-sm font-extrabold tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0" style={{ color: titleFg }}>
                          {item.name}
                        </span>
                        {titleLayout.showTaskCount && (
                          <span
                            className="inline-flex items-center text-[10px] font-extrabold px-[7px] py-[2px] rounded-full whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0"
                            style={{
                              color: nodeColor,
                              background: getGroupCardPillBg(item.depth),
                              border: `1px solid ${getGroupCardBorder(item.depth)}`,
                              maxWidth: `${titleLayout.countMaxWidth}px`,
                            }}
                          >
                            <span className="overflow-hidden text-ellipsis">
                              {item.childTaskIds.length} {t('dashboard.tasksLabel', 'tasks')}
                            </span>
                          </span>
                        )}
                        {titleLayout.showProgress && (
                          <span
                            className="ml-auto flex items-center flex-shrink-0 overflow-hidden"
                            style={{ width: `${GROUP_TITLE_PROGRESS_WIDTH}px` }}
                          >
                            <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-right text-[11px] font-black tabular-nums" style={{ color: nodeColor }}>{weightedProgress}%</span>
                          </span>
                        )}
                      </button>
                    </div>
                  );
                }

                const task = item;
                  const start = getStartDateForCal(task);
                  const end = getTargetDateForCal(task);
                
                if (!start || !end) return null;

                const left = getPositionForDate(start);
                const duration = diffDays(start, end);
                const width = duration * dayWidth;
                const minBarWidth = Math.max(48, Math.floor(dayWidth * 0.8));
                const displayWidth = Math.max(width, minBarWidth);
                const isSelected = selectedTaskId === task.id;
                const isLinkDropTarget = Boolean(linkDragState && linkDragState.sourceTaskId !== task.id);
                const taskDrag = taskBarDragState?.taskId === task.id ? taskBarDragState : null;

                return (
                  <div key={task.id} className={`relative h-[72px] w-full flex items-center group px-2 ${isSelected ? 'z-20' : 'z-10'}`}>
                    {isSelected && (
                      <div className="absolute inset-y-0 left-0 right-0 bg-primary/[0.03] pointer-events-none" />
                    )}
                    <div
                      className={`absolute h-10 rounded-lg border flex items-center px-4 select-none ${
                        taskDrag?.hasMoved ? 'cursor-grabbing transition-[box-shadow,border-color,ring-color]' : 'cursor-grab transition-[transform,box-shadow,border-color,ring-color]'
                      } ${
                        isSelected 
                          ? `ring-4 ring-primary/30 border-primary shadow-lg scale-[1.02] z-30 ${getStatusColor(task.status).replace('border-slate-200', 'border-primary')}` 
                          : `shadow-md hover:scale-[1.02] hover:z-20 active:scale-[0.98] ${getStatusColor(task.status)}`
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${displayWidth}px`,
                        transform: taskDrag?.hasMoved ? `translate(${taskDrag.deltaX}px, ${taskDrag.deltaY}px)` : undefined,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'manipulation',
                        zIndex: taskDrag?.hasMoved ? 45 : undefined,
                      }}
                      onClick={() => {
                        if (suppressNextClickRef.current) {
                          suppressNextClickRef.current = false;
                          return;
                        }
                        handleTaskActivate(task.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openContextMenu(e.clientX, e.clientY, task.id, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        clearLongPressTimer();
                        handleTaskBarPointerMove(e, task.id);
                      }}
                      onPointerUp={(e) => {
                        clearLongPressTimer();
                        handleTaskBarPointerEnd(e, task);
                      }}
                      onPointerCancel={(e) => {
                        clearLongPressTimer();
                        if (taskBarDragState?.taskId === task.id && taskBarDragState.pointerId === e.pointerId) {
                          setTaskBarDragState(null);
                        }
                      }}
                      onPointerLeave={clearLongPressTimer}
                      onPointerDown={(e) => {
                        if (e.pointerType !== 'mouse') {
                          clearLongPressTimer();
                          const { clientX, clientY, currentTarget } = e;
                          longPressTimerRef.current = setTimeout(() => {
                            suppressNextClickRef.current = true;
                            openContextMenu(clientX, clientY, task.id, currentTarget);
                          }, 550);
                          return;
                        }
                        handleTaskBarPointerDown(e, task, index);
                      }}
                      aria-pressed={isLinkMode ? selectedLinkTaskIds.includes(task.id) : undefined}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTaskActivate(task.id);
                        }
                      }}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold leading-tight line-clamp-2 overflow-hidden text-ellipsis break-words">
                          <span className="text-slate-400">{task.displayId}</span>{' '}
                          {task.title}
                        </span>
                      </div>
                      {task.progress === 100 && (
                        <div className="ml-2 flex items-center">
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                        </div>
                      )}
                    </div>
                     {/* Start Connector Node */}
                    <div 
                      data-gantt-link-handle="true"
                      className={`absolute z-40 flex items-center justify-center rounded-full cursor-crosshair transition-[transform,box-shadow,border-color,ring-color,opacity] ${
                        hoveredTargetTaskId === task.id
                          ? 'w-6 h-6 bg-emerald-50 opacity-100 ring-2 ring-emerald-400/80 shadow-md shadow-emerald-500/20 scale-105'
                          : isLinkDropTarget
                            ? 'w-5 h-5 bg-indigo-100/80 opacity-100 ring-2 ring-indigo-300/60 shadow-md shadow-indigo-500/20'
                            : 'w-7 h-7 opacity-0 group-hover:opacity-100'
                      }`}
                      style={{ left: `${left}px`, top: '50%', transform: 'translate(-50%, -50%)' }}
                      onMouseEnter={() => {
                        if (linkDragState && linkDragState.sourceTaskId !== task.id) {
                          setHoveredTargetTaskId(task.id);
                        }
                      }}
                      onMouseLeave={() => {
                        if (hoveredTargetTaskId === task.id) {
                          setHoveredTargetTaskId(null);
                        }
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleLinkDrop(task.id);
                      }}
                      title={t('dashboard.dropToCreateLink') || "Drop to create link"}
                    >
                      <span
                        className={`rounded-full border-2 transition-all ${
                          hoveredTargetTaskId === task.id
                            ? 'w-3 h-3 bg-emerald-500 border-white animate-pulse'
                            : isLinkDropTarget
                              ? 'w-2.5 h-2.5 bg-indigo-500 border-white'
                              : 'w-3 h-3 bg-indigo-200 border-indigo-500 hover:scale-125'
                        }`}
                      />
                    </div>
                    {/* End Connector Node */}
                    <div 
                      data-gantt-link-handle="true"
                      className="absolute w-3 h-3 rounded-full bg-indigo-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-[opacity,transform] z-40 cursor-grab active:cursor-grabbing hover:scale-125 shadow-sm"
                      style={{ left: `${left + displayWidth - 6}px`, top: '50%', transform: 'translateY(-50%)' }}
                      onMouseDown={(e) => {
                        handleLinkDragStart(e, task.id, left + displayWidth, index * 72 + 36);
                      }}
                      title={t('dashboard.dragToLink') || "Drag to link to successor"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="absolute inset-0 z-[100]" 
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div 
            className="absolute bg-white/95 rounded-xl shadow-2xl border border-slate-200/60 py-1.5 min-w-[200px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y,
              transform: (contextMenu.x > (viewportInfo.clientWidth - 220)) ? 'translateX(-100%)' : 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => {
                setIsLinkMode(true);
                setSelectedLinkTaskIds([contextMenu.taskId]);
                setContextMenu(null);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              {t('dashboard.addSuccessors')}
            </button>
            {contextBreakLinkPlan && (contextBreakLinkPlan.hasPredecessors || contextBreakLinkPlan.hasSuccessors) && (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => {
                    handleBreakLinksFromContext(contextMenu.taskId, 'all');
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">link_off</span>
                  {t('dashboard.breakAllLinks')}
                </button>
                {contextBreakLinkPlan.hasPredecessors && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    onClick={() => {
                      handleBreakLinksFromContext(contextMenu.taskId, 'predecessors');
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">call_received</span>
                    {t('dashboard.breakWithPredecessors')}
                  </button>
                )}
                {contextBreakLinkPlan.hasSuccessors && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    onClick={() => {
                      handleBreakLinksFromContext(contextMenu.taskId, 'successors');
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">call_made</span>
                    {t('dashboard.breakWithSuccessors')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isLinkMode && (
        <div className="md:hidden border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md absolute bottom-0 left-0 right-0 z-30">
          <FloatingSequenceBuilder variant="inline" />
        </div>
      )}

      {/* Zoom toolbar - floating at right bottom corner of the Gantt chart (over content).
          Row height and fonts are intentionally not scaled. */}
      <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1 rounded-md border border-slate-200/70 bg-white/90 backdrop-blur px-1 py-0.5 shadow-sm">
        <IconButton
          icon="zoom_out"
          variant="ghost"
          size="xs"
          onClick={() => setGanttZoomPercent(p => Math.max(50, p - 5))}
          aria-label={t('dashboard.zoomOut', 'Zoom out')}
          title={t('dashboard.zoomOut', 'Zoom out')}
          disabled={ganttZoomPercent <= 50}
        />
        <button
          type="button"
          onClick={() => setGanttZoomPercent(100)}
          className="text-[10px] tabular-nums font-bold text-slate-500 hover:text-primary px-1 select-none"
          title={t('dashboard.resetZoom', 'Reset zoom') || 'Reset zoom'}
          aria-label={t('dashboard.resetZoom', 'Reset zoom') || 'Reset zoom'}
        >
          {ganttZoomPercent}%
        </button>
        <IconButton
          icon="zoom_in"
          variant="ghost"
          size="xs"
          onClick={() => setGanttZoomPercent(p => Math.min(100, p + 5))}
          aria-label={t('dashboard.zoomIn', 'Zoom in')}
          title={t('dashboard.zoomIn', 'Zoom in')}
          disabled={ganttZoomPercent >= 100}
        />
      </div>
    </main>
  );
}
