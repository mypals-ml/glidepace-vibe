import { useEffect, useLayoutEffect, useRef } from 'react';
import { BASE_DAY_WIDTH, getViewportInfo } from './timelineChartConstants';

interface UseTimelineChartZoomGesturesOptions {
  activeScrollRef: React.RefObject<HTMLDivElement | null>;
  dayWidth: number;
  ganttZoomPercent: number;
  setGanttZoomPercent: React.Dispatch<React.SetStateAction<number>>;
  setViewportInfo: React.Dispatch<React.SetStateAction<{
    scrollLeft: number;
    scrollTop: number;
    clientWidth: number;
    clientHeight: number;
  }>>;
}

export function useTimelineChartZoomGestures({
  activeScrollRef,
  dayWidth,
  ganttZoomPercent,
  setGanttZoomPercent,
  setViewportInfo,
}: UseTimelineChartZoomGesturesOptions) {
  const prevDayWidthRef = useRef(dayWidth);
  const dayWidthRef = useRef(dayWidth);
  const zoomPercentRef = useRef(ganttZoomPercent);
  const lastPinchDistRef = useRef<number | null>(null);
  const pinchAnchorDayIndexRef = useRef<number | null>(null);
  const pendingDesiredScrollRef = useRef<number | null>(null);

  useEffect(() => {
    dayWidthRef.current = dayWidth;
    zoomPercentRef.current = ganttZoomPercent;
  }, [dayWidth, ganttZoomPercent]);

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
  }, [dayWidth, activeScrollRef, setViewportInfo]);

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
  }, [activeScrollRef, setGanttZoomPercent, setViewportInfo]);
}