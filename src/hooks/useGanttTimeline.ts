import { useState, useRef, useCallback, useEffect } from 'react';

interface TimelineRange {
  start: Date;
  totalDays: number;
}

interface UseGanttTimelineProps {
  dayWidth: number;
  initialBufferDaysLeft: number;
  initialBufferDaysRight: number;
  expansionThresholdPx: number;
  expansionDays: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onTimelineUpdate?: (range: TimelineRange) => void;
}

export function useGanttTimeline({
  dayWidth,
  initialBufferDaysLeft,
  initialBufferDaysRight,
  expansionThresholdPx,
  expansionDays,
  scrollRef,
  onTimelineUpdate
}: UseGanttTimelineProps) {
  const [timelineRange, setTimelineRange] = useState<TimelineRange>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - initialBufferDaysLeft);
    return {
      start,
      totalDays: initialBufferDaysLeft + initialBufferDaysRight
    };
  });

  const isExpanding = useRef(false);
  const pendingScrollAdjustment = useRef(0);
  const isProgrammaticScroll = useRef(false);

  const getPositionForDate = useCallback((dateStr: string | Date) => {
    if (!dateStr) return 0;
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const diff = (d.getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff) * dayWidth;
  }, [timelineRange.start, dayWidth]);

  // Adjust scrollLeft when timelineStart shifts (infinite scroll left)
  useEffect(() => {
    if (pendingScrollAdjustment.current !== 0 && scrollRef.current) {
      isProgrammaticScroll.current = true;
      scrollRef.current.scrollLeft += pendingScrollAdjustment.current;
      pendingScrollAdjustment.current = 0;
      
      // Release the expansion lock after the DOM has been updated and scrolled
      isExpanding.current = false;
    }
  }, [timelineRange.start, scrollRef]);

  const expandTimeline = useCallback((direction: 'left' | 'right') => {
    if (isExpanding.current) return;
    
    isExpanding.current = true;

    if (direction === 'left') {
      pendingScrollAdjustment.current = expansionDays * dayWidth;
      setTimelineRange(prev => {
        const newStart = new Date(prev.start);
        newStart.setDate(newStart.getDate() - expansionDays);
        return {
          start: newStart,
          totalDays: prev.totalDays + expansionDays
        };
      });
    } else {
      setTimelineRange(prev => ({
        ...prev,
        totalDays: prev.totalDays + expansionDays
      }));
      // For right expansion, we don't need a scroll adjustment, so release lock soon
      // Using a small timeout to let the DOM update
      setTimeout(() => {
        isExpanding.current = false;
      }, 50);
    }
  }, [expansionDays, dayWidth]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = target;

    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    if (isExpanding.current) return;

    // Right expansion
    if (scrollLeft + clientWidth > scrollWidth - expansionThresholdPx) {
      expandTimeline('right');
    }
    
    // Left expansion
    else if (scrollLeft < expansionThresholdPx) {
      expandTimeline('left');
    }
  }, [expansionThresholdPx, expandTimeline]);

  const centerOnDate = useCallback((dateStr: string | Date, behavior: ScrollBehavior = 'smooth') => {
    if (!scrollRef.current) return;

    const targetDate = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const targetTime = targetDate.getTime();
    const startTime = timelineRange.start.getTime();
    const endTime = startTime + (timelineRange.totalDays * 24 * 60 * 60 * 1000);

    // If outside current range, expand first
    if (targetTime < startTime) {
      const daysToAdd = Math.ceil((startTime - targetTime) / (24 * 60 * 60 * 1000)) + expansionDays;
      pendingScrollAdjustment.current = daysToAdd * dayWidth;
      setTimelineRange(prev => {
        const d = new Date(prev.start);
        d.setDate(d.getDate() - daysToAdd);
        return {
          start: d,
          totalDays: prev.totalDays + daysToAdd
        };
      });
      // The centering will happen in the next render cycle or via dependency
      return;
    }

    if (targetTime > endTime - (dayWidth * 2)) {
      const daysToAdd = Math.ceil((targetTime - endTime) / (24 * 60 * 60 * 1000)) + expansionDays;
      setTimelineRange(prev => ({
        ...prev,
        totalDays: prev.totalDays + daysToAdd
      }));
      // Centering will follow
    }

    const pos = getPositionForDate(dateStr);
    const halfViewport = scrollRef.current.clientWidth / 2;
    isProgrammaticScroll.current = true;
    scrollRef.current.scrollTo({
      left: pos - halfViewport + (dayWidth / 2),
      behavior
    });
  }, [timelineRange, dayWidth, expansionDays, scrollRef, getPositionForDate]);

  // Sync range to parent if needed
  useEffect(() => {
    if (onTimelineUpdate) {
      onTimelineUpdate(timelineRange);
    }
  }, [timelineRange, onTimelineUpdate]);

  return {
    timelineRange,
    getPositionForDate,
    handleScroll,
    centerOnDate,
    isProgrammaticScroll
  };
}
