import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { IconButton } from '../../UI/IconButton';
import { useTimelineChart } from '../../../hooks/useTimelineChart';
import { DependencyLines } from './DependencyLines';
import { FloatingSequenceBuilder } from '../FloatingSequenceBuilder';
import { isTaskGroupBlock } from '../../../lib/taskGroupUtils';
import { defaultWorkCalendar } from '../../../lib/workCalendar';
import { getScrollTopForSelectedRow } from '../../../lib/scrollUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../../lib/contextMenuLinkUtils';
import type { DashboardFieldGroupContext } from '../../../lib/taskOrderUtils';
import {
  buildTimelineTaskBarDropPlan,
  computeGroupRowSpans,
  getGroupWeightedProgress,
  getTimelineTaskBarLayout,
  type TimelineTaskBarDropPlan,
} from './timelineChartUtils';
import {
  BASE_DAY_WIDTH,
  EXPANSION_DAYS,
  EXPANSION_THRESHOLD_PX,
  getViewportInfo,
  INITIAL_BUFFER_DAYS_LEFT,
  INITIAL_BUFFER_DAYS_RIGHT,
  MAX_ZOOM,
  MIN_ZOOM,
  ROW_HEIGHT,
  TASK_BAR_DRAG_THRESHOLD_PX,
} from './timelineChartConstants';
import { TimelineChartContextMenu } from './TimelineChartContextMenu';
import { TimelineGroupRow } from './TimelineGroupRow';
import { TimelineTaskRow } from './TimelineTaskRow';
import { useTimelineChartZoomGestures } from './useTimelineChartZoomGestures';
import type { Task } from '../../../types';

export interface TimelineChartProps {
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export function TimelineChart({ className = '', scrollRef, onScroll }: TimelineChartProps) {
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

  const {
    timelineRange, 
    timelineExpansionVersion,
    getPositionForDate, 
    handleScroll: handleTimelineScroll,
    centerOnDate 
  } = useTimelineChart({
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

  const groupRowSpans = useMemo(() => computeGroupRowSpans(dashboardItems), [dashboardItems]);

  useTimelineChartZoomGestures({
    activeScrollRef,
    dayWidth,
    ganttZoomPercent,
    setGanttZoomPercent,
    setViewportInfo,
  });

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

  const applyTaskBarDropPlan = async (task: Task, plan: TimelineTaskBarDropPlan) => {
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
    const plan = buildTimelineTaskBarDropPlan({
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
                  return (
                    <TimelineGroupRow
                      key={item.groupBlockId}
                      item={item}
                      dayWidth={dayWidth}
                      rowSpan={groupRowSpans[item.groupBlockId] ?? 1}
                      weightedProgress={getGroupWeightedProgress(item, filteredTasks)}
                      getPositionForDate={getPositionForDate}
                      onToggleCollapsed={toggleGroupBlockCollapsed}
                    />
                  );
                }

                const task = item;
                const layout = getTimelineTaskBarLayout(task, dayWidth, getPositionForDate);
                if (!layout) return null;

                const taskDrag = taskBarDragState?.taskId === task.id ? taskBarDragState : null;

                return (
                  <TimelineTaskRow
                    key={task.id}
                    task={task}
                    rowIndex={index}
                    left={layout.left}
                    displayWidth={layout.displayWidth}
                    isSelected={selectedTaskId === task.id}
                    isLinkMode={isLinkMode}
                    isLinkSelected={selectedLinkTaskIds.includes(task.id)}
                    isLinkDropTarget={Boolean(linkDragState && linkDragState.sourceTaskId !== task.id)}
                    hoveredTargetTaskId={hoveredTargetTaskId}
                    taskDrag={taskDrag}
                    onTaskActivate={handleTaskActivate}
                    onOpenContextMenu={openContextMenu}
                    onTaskBarPointerDown={handleTaskBarPointerDown}
                    onTaskBarPointerMove={handleTaskBarPointerMove}
                    onTaskBarPointerEnd={handleTaskBarPointerEnd}
                    onTaskBarPointerCancel={(e, taskId) => {
                      if (taskBarDragState?.taskId === taskId && taskBarDragState.pointerId === e.pointerId) {
                        setTaskBarDragState(null);
                      }
                    }}
                    onClearLongPressTimer={clearLongPressTimer}
                    onScheduleLongPressContextMenu={(clientX, clientY, taskId, anchor) => {
                      longPressTimerRef.current = setTimeout(() => {
                        suppressNextClickRef.current = true;
                        openContextMenu(clientX, clientY, taskId, anchor);
                      }, 550);
                    }}
                    shouldSuppressClick={() => suppressNextClickRef.current}
                    clearSuppressClick={() => {
                      suppressNextClickRef.current = false;
                    }}
                    onLinkDragStart={handleLinkDragStart}
                    onLinkDrop={handleLinkDrop}
                    onLinkHoverTargetEnter={(taskId) => setHoveredTargetTaskId(taskId)}
                    onLinkHoverTargetLeave={(taskId) => {
                      if (hoveredTargetTaskId === taskId) {
                        setHoveredTargetTaskId(null);
                      }
                    }}
                    linkDragSourceTaskId={linkDragState?.sourceTaskId ?? null}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {contextMenu && (
        <TimelineChartContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          taskId={contextMenu.taskId}
          viewportClientWidth={viewportInfo.clientWidth}
          hasPredecessors={Boolean(contextBreakLinkPlan?.hasPredecessors)}
          hasSuccessors={Boolean(contextBreakLinkPlan?.hasSuccessors)}
          onClose={() => setContextMenu(null)}
          onAddSuccessors={(taskId) => {
            setIsLinkMode(true);
            setSelectedLinkTaskIds([taskId]);
            setContextMenu(null);
          }}
          onBreakLinks={handleBreakLinksFromContext}
        />
      )}

      {isLinkMode && (
        <div className="md:hidden border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md absolute bottom-0 left-0 right-0 z-30">
          <FloatingSequenceBuilder variant="inline" />
        </div>
      )}

      {/* Zoom toolbar - floating at right bottom corner of the timeline chart (over content).
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
