import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { getStatusColor } from '../../../utils/statusColors';
import { useEffect, useMemo, useState, useRef } from 'react';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { formatToGitHubDate, diffDays } from '../../../lib/dateUtils';
import { IconButton } from '../../UI/IconButton';
import { useGanttTimeline } from '../../../hooks/useGanttTimeline';
import { DependencyLines } from './DependencyLines';
import { FloatingSequenceBuilder } from '../FloatingSequenceBuilder';

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

export function GanttChart({ className = '', scrollRef, onScroll }: GanttChartProps) {
  const { t } = useTranslation();
  const { filteredTasks, isLoadingTasks, requestedCenterDate, centerGanttOnDate, selectedTaskId, setSelectedTaskId, setIsTaskDetailsOpen, updateTaskSuccessors, isLinkMode, setIsLinkMode, selectedLinkTaskIds, setSelectedLinkTaskIds } = useDashboard();
  const [viewportInfo, setViewportInfo] = useState({ scrollLeft: 0, clientWidth: 0 });
  const internalScrollRef = useRef<HTMLDivElement>(null);
  
  // Use either the provided ref or internal one
  const activeScrollRef = scrollRef || internalScrollRef;

  const { 
    timelineRange, 
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
  const todayStr = useMemo(() => formatToGitHubDate(today), [today]);

  const selectedTask = useMemo(() => filteredTasks.find(t => t.id === selectedTaskId), [filteredTasks, selectedTaskId]);
  
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
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);

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

  const handleLinkDragStart = (e: React.MouseEvent, taskId: string, startX: number, startY: number) => {
    e.stopPropagation();
    e.preventDefault();
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
  };

  const handleLinkDrop = async (targetTaskId: string) => {
    if (!linkDragState) return;
    const sourceTaskId = linkDragState.sourceTaskId;
    setLinkDragState(null);
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

  // Ref to track what was last centered to avoid redundant centering during expansions
  const lastCenteredId = useRef<string | null>(null);

  // Handle initial centering
  useEffect(() => {
    if (activeScrollRef.current) {
      const currentSelectionKey = selectedTaskId || 'today';
      if (lastCenteredId.current === currentSelectionKey) return;

      const anchorDateStr = selectedTask ? (getStartDateForCal(selectedTask) || todayStr) : todayStr;
      centerOnDate(anchorDateStr, 'auto');
      const selectedIndex = selectedTaskId
        ? filteredTasks.findIndex(task => task.id === selectedTaskId)
        : -1;
      if (selectedIndex >= 0) {
        const targetTop = selectedIndex * 72;
        const halfViewport = activeScrollRef.current.clientHeight / 2;
        activeScrollRef.current.scrollTo({
          top: Math.max(0, targetTop - halfViewport + 36),
          behavior: 'auto'
        });
      }
      lastCenteredId.current = currentSelectionKey;
      
      setViewportInfo({
        scrollLeft: activeScrollRef.current.scrollLeft,
        clientWidth: activeScrollRef.current.clientWidth
      });
    }
  }, [activeScrollRef, selectedTaskId, todayStr, centerOnDate, selectedTask, filteredTasks]);

  // Handle external scroll requests (e.g. from Sidebar)
  useEffect(() => {
    if (requestedCenterDate) {
      centerOnDate(requestedCenterDate, 'smooth');
    }
  }, [requestedCenterDate, centerOnDate]);

  // Vertical Virtualization: Calculate visible days
  const visibleStartIndex = Math.max(0, Math.floor(viewportInfo.scrollLeft / DAY_WIDTH) - 2);
  const visibleEndIndex = Math.min(timelineRange.totalDays, Math.ceil((viewportInfo.scrollLeft + viewportInfo.clientWidth) / DAY_WIDTH) + 2);

  const visibleTimelineDays = useMemo(() => {
    const days = [];
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const d = new Date(timelineRange.start);
      d.setDate(d.getDate() + i);
      const dateStr = formatToGitHubDate(d);
      const isToday = dateStr === todayStr;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      
      days.push({
        date: dateStr,
        label: t(`days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]}`),
        dayNum: d.getDate(),
        month: d.toLocaleString('default', { month: 'short' }),
        isToday,
        isWeekend,
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
              className={`flex-shrink-0 border-r border-slate-100 flex flex-col justify-center items-center absolute top-0 bottom-0 ${day.isToday ? 'bg-indigo-50/50 text-indigo-600' : ''} ${day.isWeekend ? 'bg-slate-50/30 text-slate-400' : ''}`}
              style={{ 
                width: `${DAY_WIDTH}px`,
                left: `${day.index * DAY_WIDTH}px`
              }}
            >
              {day.isToday && <div className="absolute top-0 w-full h-0.5 bg-indigo-500"></div>}
              <span className="opacity-60">{day.month} {day.dayNum}</span>
              <span className="text-[11px] font-extrabold">{day.label}</span>
              {day.isToday && <span className="h-1 w-1 rounded-full bg-indigo-500 mt-0.5"></span>}
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
                className={`flex-shrink-0 border-r border-slate-100/50 absolute top-0 bottom-0 ${day.isToday ? 'bg-indigo-50/10' : ''} ${day.isWeekend ? 'bg-slate-50/20' : ''}`}
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
                tasks={filteredTasks} 
                getPositionForDate={getPositionForDate} 
                dayWidth={DAY_WIDTH} 
                onBreakLink={handleBreakLink}
                dragState={linkDragState}
              />
              {filteredTasks.map((task, index) => {
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
                      className={`absolute h-10 rounded-lg border flex items-center px-4 cursor-pointer transition-all ${
                        isSelected 
                          ? `ring-4 ring-primary/30 border-primary shadow-lg scale-[1.02] z-30 ${getStatusColor(task.status).replace('border-slate-200', 'border-primary')}` 
                          : `shadow-md hover:scale-[1.02] hover:z-20 active:scale-[0.98] ${getStatusColor(task.status)}`
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(width, 100)}px`, // Min width for visibility
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
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-tighter mb-0.5">{task.displayId}</span>
                        <span className="text-xs font-bold truncate leading-tight">
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
                        isLinkDropTarget
                          ? 'w-5 h-5 bg-indigo-100/80 opacity-100 ring-2 ring-indigo-300/60 shadow-md shadow-indigo-500/20'
                          : 'w-7 h-7 opacity-0 group-hover:opacity-100'
                      }`}
                      style={{ left: `${left}px`, top: '50%', transform: 'translate(-50%, -50%)' }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleLinkDrop(task.id);
                      }}
                      title={t('dashboard.dropToCreateLink') || "Drop to create link"}
                    >
                      <span
                        className={`rounded-full border-2 transition-all ${
                          isLinkDropTarget
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
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                const tObj = filteredTasks.find(tObj => tObj.id === contextMenu.taskId);
                if (tObj && tObj.successorIds && tObj.successorIds.length > 0) {
                  updateTaskSuccessors(contextMenu.taskId, []);
                }
                setContextMenu(null);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              {t('dashboard.breakAllLinks')}
            </button>
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
