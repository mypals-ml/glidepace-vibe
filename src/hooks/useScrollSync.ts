import { useRef, useCallback } from 'react';

/**
 * A hook to synchronize vertical scrolling between two elements.
 * Uses an isSyncing ref and requestAnimationFrame to avoid infinite scroll loops.
 */
export function useScrollSync() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  const onSidebarScroll = useCallback(() => {
    if (isSyncing.current || !sidebarRef.current || !timelineRef.current) return;
    isSyncing.current = true;
    const top = sidebarRef.current.scrollTop;
    requestAnimationFrame(() => {
      if (timelineRef.current) {
        timelineRef.current.scrollTop = top;
      }
      isSyncing.current = false;
    });
  }, []);

  const onTimelineScroll = useCallback(() => {
    if (isSyncing.current || !timelineRef.current || !sidebarRef.current) return;
    isSyncing.current = true;
    const top = timelineRef.current.scrollTop;
    requestAnimationFrame(() => {
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop = top;
      }
      isSyncing.current = false;
    });
  }, []);

  return { sidebarRef, timelineRef, onSidebarScroll, onTimelineScroll };
}
