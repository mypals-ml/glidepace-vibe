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
import { getTreeColor, getGroupCardTitleBg, getGroupCardContentBg, getGroupCardBorder, getGroupCardTitleFg } from '../../../lib/treeColors';

export interface GanttChartProps {
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const DAY_WIDTH = 120;
const INITIAL_BUFFER_DAYS_LEFT = 14;
const INITIAL_BUFFER_DAYS_RIGHT = 30;
const EXPANSION_THRESHOLD_PX = 300;
const EXPANSION_DAYS = 14;
const ROW_HEIGHT = 72;

export function GanttChart({ className = '', scrollRef, onScroll }: GanttChartProps) {
  const { t } = useTranslation();
  const { tasks, filteredTasks, dashboardItems, isLoadingTasks, requestedCenterDate, requestedCenterTaskId, centerGanttOnDate, completeGanttCenterRequest, selectedTaskId, setSelectedTaskId, setIsTaskDetailsOpen, updateTaskSuccessors, isLinkMode, setIsLinkMode, selectedLinkTaskIds, setSelectedLinkTaskIds, toggleGroupBlockCollapsed } = useDashboard();
  const [viewportInfo, setViewportInfo] = useState({ scrollLeft: 0, clientWidth: 0 });
  const internalScrollRef = useRef<HTMLDivElement>(null);
  
  // Use either the provided ref or internal one
  const activeScrollRef = scrollRef || internalScrollRef;

  const { 
    timelineRange, 
    timelineExpansionVersion,
    getPositionForDate, 
    handleScroll: handleTimelineScroll,
    centerOnDate 
  } = useGanttTimeline({
    dayWidth: DAY_WIDTH,
    initialBufferDaysLeft: INITIAL_BUFFER_DAYS_LEFT,
    initialBufferDaysRight: INITIAL_BUFFER_DAYS_RIGHT,
    expansionThresholdPx: EXPANSION_THRESHOLD_PX,
    expansionDays: EXPANSION_DAYS,
    scrollRef: activeScrollRef
  });

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => defaultWorkCalendar.formatDate(today), [today]);

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
        if (dashboardItems[j].depth <= item.depth) break;
        rows += 1;
      }
      spans[item.groupBlockId] = rows;
    }
    return spans;
  }, [dashboardItems]);

  // Update viewport info on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = e.currentTarget;
    setViewportInfo({ scrollLeft, clientWidth });
    
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

  // Handle initial centering
  useEffect(() => {
    if (didCenterInitialRef.current) return;

    if (activeScrollRef.current) {
      didCenterInitialRef.current = true;
      centerOnDate(todayStr, 'auto');
      setViewportInfo({
        scrollLeft: activeScrollRef.current.scrollLeft,
        clientWidth: activeScrollRef.current.clientWidth
      });
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
  const visibleStartIndex = Math.max(0, Math.floor(viewportInfo.scrollLeft / DAY_WIDTH) - 2);
  const visibleEndIndex = Math.min(timelineRange.totalDays, Math.ceil((viewportInfo.scrollLeft + viewportInfo.clientWidth) / DAY_WIDTH) + 2);

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
            width: `${timelineRange.totalDays * DAY_WIDTH}px`,
            transform: `translateX(-${viewportInfo.scrollLeft}px)`
          }}
        >
          {visibleTimelineDays.map((day) => (
            <div 
              key={day.date} 
              className={`flex-shrink-0 border-r border-slate-100 flex flex-col justify-center items-center gap-px absolute top-0 bottom-0 ${day.isNonWorkday ? 'bg-slate-200/70 text-slate-500' : ''} ${day.isToday ? '!bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500/35' : ''}`}
              style={{ 
                width: `${DAY_WIDTH}px`,
                left: `${day.index * DAY_WIDTH}px`
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
        <div className="relative pb-[var(--search-bar-height)]" style={{ width: `${timelineRange.totalDays * DAY_WIDTH}px`, minHeight: '100%' }}>
          {/* Background Grid */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {visibleTimelineDays.map((day) => (
              <div 
                key={day.date} 
                className={`flex-shrink-0 border-r border-slate-100/50 absolute top-0 bottom-0 ${day.isNonWorkday ? 'bg-slate-200/45' : ''} ${day.isToday && !day.isNonWorkday ? 'bg-indigo-50/20' : ''}`}
                style={{ 
                  width: `${DAY_WIDTH}px`,
                  left: `${day.index * DAY_WIDTH}px`
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
                getPositionForDate={getPositionForDate} 
                dayWidth={DAY_WIDTH} 
                onBreakLink={handleBreakLink}
                dragState={linkDragState}
                hoveredTargetTaskId={hoveredTargetTaskId}
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
                  const CARD_PAD = 9;
                  const TITLE_H = 40;
                  const CARD_RADIUS = 8;
                  const spanLeft = getPositionForDate(groupStart);
                  const duration = diffDays(groupStart, groupEnd);
                  const spanWidth = duration * DAY_WIDTH;
                  const cardLeft = spanLeft - CARD_PAD;
                  const cardWidth = Math.max(spanWidth, 120) + CARD_PAD * 2;
                  const weightedProgress = getGroupWeightedProgress(item);
                  const isOpen = item.isExpanded;
                  const rowSpan = groupRowSpans[item.groupBlockId] ?? 1;
                  // Card height: own row + descendant rows when expanded, else just the title row.
                  const cardHeight = isOpen
                    ? (rowSpan - 1) * ROW_HEIGHT + TITLE_H + (72 - TITLE_H) / 2
                    : TITLE_H;
                  const titleTop = (72 - TITLE_H) / 2;

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
                          borderRadius: `${CARD_RADIUS}px`,
                          zIndex: 0,
                        }}
                      />
                      {/* group bar == card title row */}
                      <button
                        type="button"
                        onClick={() => toggleGroupBlockCollapsed(item.groupBlockId)}
                        className="absolute flex items-center gap-[9px] text-left"
                        style={{
                          left: `${cardLeft}px`,
                          width: `${cardWidth}px`,
                          top: `${titleTop}px`,
                          height: `${TITLE_H}px`,
                          padding: '0 13px 0 6px',
                          background: titleBg,
                          borderRadius: isOpen
                            ? `${CARD_RADIUS}px ${CARD_RADIUS}px 0 0`
                            : `${CARD_RADIUS}px`,
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
                        <span className="text-sm font-extrabold tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: titleFg }}>
                          {item.name}
                        </span>
                        <span
                          className="inline-flex items-center text-[10px] font-extrabold px-[7px] py-[2px] rounded-full whitespace-nowrap flex-shrink-0"
                          style={{ color: nodeColor, background: getGroupCardPillBg(item.depth), border: `1px solid ${getGroupCardBorder(item.depth)}` }}
                        >
                          {item.childTaskIds.length} {t('dashboard.tasksLabel', 'tasks')}
                        </span>
                        <span className="ml-auto flex items-center gap-[7px] flex-shrink-0">
                          <span className="w-[46px] h-[5px] rounded-full bg-slate-200 overflow-hidden">
                            <span className="block h-full rounded-full" style={{ width: `${weightedProgress}%`, background: nodeColor }} />
                          </span>
                          <span className="text-[11px] font-black tabular-nums" style={{ color: nodeColor }}>{weightedProgress}%</span>
                        </span>
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
                const width = duration * DAY_WIDTH;
                const isSelected = selectedTaskId === task.id;
                const isLinkDropTarget = Boolean(linkDragState && linkDragState.sourceTaskId !== task.id);

                return (
                  <div key={task.id} className={`relative h-[72px] w-full flex items-center group px-2 ${isSelected ? 'z-20' : 'z-10'}`}>
                    {isSelected && (
                      <div className="absolute inset-y-0 left-0 right-0 bg-primary/[0.03] pointer-events-none" />
                    )}
                    <div
                      className={`absolute h-10 rounded-lg border flex items-center px-4 cursor-pointer select-none transition-all ${
                        isSelected 
                          ? `ring-4 ring-primary/30 border-primary shadow-lg scale-[1.02] z-30 ${getStatusColor(task.status).replace('border-slate-200', 'border-primary')}` 
                          : `shadow-md hover:scale-[1.02] hover:z-20 active:scale-[0.98] ${getStatusColor(task.status)}`
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(width, 100)}px`, // Min width for visibility
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'manipulation',
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
                      onPointerDown={(e) => {
                        if (e.pointerType === 'mouse') return;
                        clearLongPressTimer();
                        const { clientX, clientY, currentTarget } = e;
                        longPressTimerRef.current = setTimeout(() => {
                          suppressNextClickRef.current = true;
                          openContextMenu(clientX, clientY, task.id, currentTarget);
                        }, 550);
                      }}
                      onPointerMove={clearLongPressTimer}
                      onPointerUp={clearLongPressTimer}
                      onPointerCancel={clearLongPressTimer}
                      onPointerLeave={clearLongPressTimer}
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
                      {task.progress > 0 && task.progress < 100 && (
                        <div className="ml-2 flex items-center gap-2">
                          <div className="w-10 h-1.5 bg-black/10 rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full bg-current opacity-60" style={{ width: `${task.progress}%` }}></div>
                          </div>
                          <span className="text-[10px] font-black opacity-60">{task.progress}%</span>
                        </div>
                      )}
                    </div>
                     {/* Start Connector Node */}
                    <div 
                      className={`absolute z-40 flex items-center justify-center rounded-full cursor-crosshair transition-all ${
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
                      className="absolute w-3 h-3 rounded-full bg-indigo-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity z-40 cursor-grab active:cursor-grabbing hover:scale-125 shadow-sm"
                      style={{ left: `${left + Math.max(width, 100) - 6}px`, top: '50%', transform: 'translateY(-50%)' }}
                      onMouseDown={(e) => {
                        handleLinkDragStart(e, task.id, left + Math.max(width, 100), index * 72 + 36);
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
    </main>
  );
}
