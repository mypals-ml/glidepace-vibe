import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const [timelineExpansionVersion, setTimelineExpansionVersion] = useState(0);

  const isExpanding = useRef(false);
  const pendingScrollAdjustment = useRef(0);
  const isProgrammaticScroll = useRef(false);

  const expandTimelineRange = useCallback((updater: (prev: TimelineRange) => TimelineRange) => {
    setTimelineRange(updater);
    setTimelineExpansionVersion(version => version + 1);
  }, []);

  const getPositionForDate = useCallback((dateStr: string | Date) => {
    if (!dateStr) return 0;
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const diff = (d.getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff) * dayWidth;
  }, [timelineRange.start, dayWidth]);

  // Adjust scrollLeft when timelineStart shifts (infinite scroll left)
  useLayoutEffect(() => {
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
      expandTimelineRange(prev => {
        const newStart = new Date(prev.start);
        newStart.setDate(newStart.getDate() - expansionDays);
        return {
          start: newStart,
          totalDays: prev.totalDays + expansionDays
        };
      });
    } else {
      expandTimelineRange(prev => ({
        ...prev,
        totalDays: prev.totalDays + expansionDays
      }));
      // For right expansion, we don't need a scroll adjustment, so release lock soon
      // Using a small timeout to let the DOM update
      setTimeout(() => {
        isExpanding.current = false;
      }, 50);
    }
  }, [expansionDays, dayWidth, expandTimelineRange]);

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
    if (!scrollRef.current) return false;

    const targetDate = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const targetTime = targetDate.getTime();
    const startTime = timelineRange.start.getTime();
    const endTime = startTime + (timelineRange.totalDays * DAY_MS);

    // If outside current range, expand first
    if (targetTime < startTime) {
      const daysToAdd = Math.ceil((startTime - targetTime) / DAY_MS) + expansionDays;
      pendingScrollAdjustment.current = daysToAdd * dayWidth;
      expandTimelineRange(prev => {
        const d = new Date(prev.start);
        d.setDate(d.getDate() - daysToAdd);
        return {
          start: d,
          totalDays: prev.totalDays + daysToAdd
        };
      });
      return false;
    }

    if (targetTime >= endTime) {
      const daysToAdd = Math.ceil((targetTime - endTime) / DAY_MS) + expansionDays + 1;
      expandTimelineRange(prev => ({
        ...prev,
        totalDays: prev.totalDays + daysToAdd
      }));
      return false;
    }

    const pos = getPositionForDate(dateStr);
    const halfViewport = scrollRef.current.clientWidth / 2;
    isProgrammaticScroll.current = true;
    scrollRef.current.scrollTo({
      left: pos - halfViewport + (dayWidth / 2),
      behavior
    });
    return true;
  }, [timelineRange, dayWidth, expansionDays, scrollRef, getPositionForDate, expandTimelineRange]);

  // Sync range to parent if needed
  useEffect(() => {
    if (onTimelineUpdate) {
      onTimelineUpdate(timelineRange);
    }
  }, [timelineRange, onTimelineUpdate]);

  return {
    timelineRange,
    timelineExpansionVersion,
    getPositionForDate,
    handleScroll,
    centerOnDate,
    isProgrammaticScroll
  };
}
