import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { getStatusColor } from '../../../utils/statusColors';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { formatToGitHubDate, diffDays } from '../../../lib/dateUtils';
import { IconButton } from '../../UI/IconButton';

export interface GanttChartProps {
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const DAY_WIDTH = 120;
const INITIAL_BUFFER_DAYS_LEFT = 7;
const INITIAL_BUFFER_DAYS_RIGHT = 30;
const EXPANSION_THRESHOLD_PX = 800;
const EXPANSION_DAYS = 60;

export function GanttChart({ className = '', scrollRef, onScroll }: GanttChartProps) {
  const { t } = useTranslation();
  const { filteredTasks, isLoadingTasks, requestedCenterDate, centerGanttOnDate, selectedTaskId, setSelectedTaskId, setIsTaskDetailsOpen } = useDashboard();
  const [viewportInfo, setViewportInfo] = useState({ scrollLeft: 0, clientWidth: 0 });
  const internalScrollRef = useRef<HTMLDivElement>(null);
  
  // Use either the provided ref or internal one
  const activeScrollRef = scrollRef || internalScrollRef;

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatToGitHubDate(today), [today]);

  const selectedTask = useMemo(() => filteredTasks.find(t => t.id === selectedTaskId), [filteredTasks, selectedTaskId]);
  
  // Dynamic timeline state
  const [timelineStart, setTimelineStart] = useState<Date>(() => {
    const anchorDate = selectedTask ? new Date(getStartDateForCal(selectedTask) || today) : new Date(today);
    anchorDate.setDate(anchorDate.getDate() - INITIAL_BUFFER_DAYS_LEFT);
    return anchorDate;
  });
  const [totalDays, setTotalDays] = useState(INITIAL_BUFFER_DAYS_LEFT + INITIAL_BUFFER_DAYS_RIGHT);
  const pendingScrollAdjustment = useRef<number>(0);
  const isProgrammaticScroll = useRef(false);

  const getPositionForDate = useCallback((dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diff = (d.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff) * DAY_WIDTH;
  }, [timelineStart]);

  // Handle initial centering
  useEffect(() => {
    if (activeScrollRef.current) {
      const anchorDateStr = selectedTask ? (getStartDateForCal(selectedTask) || todayStr) : todayStr;
      const pos = getPositionForDate(anchorDateStr);
      const halfViewport = activeScrollRef.current.clientWidth / 2;
      isProgrammaticScroll.current = true;
      activeScrollRef.current.scrollLeft = pos - halfViewport + (DAY_WIDTH / 2);
      
      setViewportInfo({
        scrollLeft: activeScrollRef.current.scrollLeft,
        clientWidth: activeScrollRef.current.clientWidth
      });
    }
    // Only on mount or when anchor context changes fundamentally
  }, [activeScrollRef, selectedTaskId, todayStr, getPositionForDate]); // Use selectedTaskId instead of selectedTask object

  // Adjust scrollLeft when timelineStart shifts (infinite scroll left)
  useEffect(() => {
    if (pendingScrollAdjustment.current !== 0 && activeScrollRef.current) {
      isProgrammaticScroll.current = true;
      activeScrollRef.current.scrollLeft += pendingScrollAdjustment.current;
      pendingScrollAdjustment.current = 0;
      
      // Update viewport info after adjustment
      setViewportInfo({
        scrollLeft: activeScrollRef.current.scrollLeft,
        clientWidth: activeScrollRef.current.clientWidth
      });
    }
  }, [timelineStart, activeScrollRef]);

  // Handle external scroll requests (e.g. from Sidebar)
  useEffect(() => {
    if (requestedCenterDate && activeScrollRef.current) {
      const targetDate = new Date(requestedCenterDate);
      const targetTime = targetDate.getTime();
      const startTime = timelineStart.getTime();
      const endTime = startTime + (totalDays * 24 * 60 * 60 * 1000);

      // Expand left if needed
      if (targetTime < startTime) {
        const daysToadd = Math.ceil((startTime - targetTime) / (24 * 60 * 60 * 1000)) + 15;
        pendingScrollAdjustment.current = daysToadd * DAY_WIDTH;
        queueMicrotask(() => {
          setTimelineStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - daysToadd);
            return d;
          });
          setTotalDays(prev => prev + daysToadd);
        });
        return; // Wait for re-render
      }

      // Expand right if needed
      if (targetTime > endTime - (DAY_WIDTH * 2)) { // buffer
        const daysToadd = Math.ceil((targetTime - endTime) / (24 * 60 * 60 * 1000)) + 30;
        queueMicrotask(() => {
          setTotalDays(prev => prev + daysToadd);
        });
        return; // Wait for re-render
      }

      const pos = getPositionForDate(requestedCenterDate);
      const halfViewport = activeScrollRef.current.clientWidth / 2;
      isProgrammaticScroll.current = true;
      activeScrollRef.current.scrollTo({
        left: pos - halfViewport + (DAY_WIDTH / 2),
        behavior: 'smooth'
      });
    }
  }, [requestedCenterDate, timelineStart, totalDays, activeScrollRef, getPositionForDate]);


  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = target;

    setViewportInfo({
      scrollLeft,
      clientWidth
    });

    // If this is a programmatic scroll (centering), don't trigger expansion logic 
    // to avoid recursion. The centering logic itself handles range issues.
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    // Expansion logic (Infinite Scroll)
    if (scrollLeft + clientWidth > scrollWidth - EXPANSION_THRESHOLD_PX) {
      setTotalDays(prev => prev + EXPANSION_DAYS);
    }
    
    if (scrollLeft < EXPANSION_THRESHOLD_PX) {
      pendingScrollAdjustment.current = EXPANSION_DAYS * DAY_WIDTH;
      setTimelineStart(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() - EXPANSION_DAYS);
        return d;
      });
      setTotalDays(prev => prev + EXPANSION_DAYS);
    }

    if (onScroll) onScroll(e);
  };

  // Vertical Virtualization: Calculate visible days
  const visibleStartIndex = Math.max(0, Math.floor(viewportInfo.scrollLeft / DAY_WIDTH) - 2);
  const visibleEndIndex = Math.min(totalDays, Math.ceil((viewportInfo.scrollLeft + viewportInfo.clientWidth) / DAY_WIDTH) + 2);

  const visibleTimelineDays = useMemo(() => {
    const days = [];
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const d = new Date(timelineStart);
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
  }, [timelineStart, visibleStartIndex, visibleEndIndex, todayStr, t]);

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
            width: `${totalDays * DAY_WIDTH}px`,
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
        className="flex-1 overflow-auto relative custom-scrollbar bg-white/40" 
        ref={activeScrollRef} 
        onScroll={handleScroll}
      >
        <div className="relative pb-[var(--search-bar-height)]" style={{ width: `${totalDays * DAY_WIDTH}px`, minHeight: '100%' }}>
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
              {filteredTasks.map((task) => {
                const start = getStartDateForCal(task);
                const end = getTargetDateForCal(task);
                
                if (!start || !end) return null;

                const left = getPositionForDate(start);
                const duration = diffDays(start, end);
                const width = duration * DAY_WIDTH;
                const isSelected = selectedTaskId === task.id;

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
                        setSelectedTaskId(task.id);
                        setIsTaskDetailsOpen(true);
                      }}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-tighter mb-0.5">{task.id}</span>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
