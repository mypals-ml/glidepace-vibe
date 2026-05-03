import { useRef, useCallback } from 'react';

/**
 * A hook to synchronize vertical scrolling between two elements.
 * Uses an isSyncing ref and requestAnimationFrame to avoid infinite scroll loops.
 */
export function useScrollSync() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const onSidebarScroll = useCallback(() => {
    const source = sidebarRef.current;
    const target = timelineRef.current;
    if (!source || !target) return;

    // Direct synchronization using an equality check to prevent infinite loops.
    // This is faster and more responsive than requestAnimationFrame for two-way sync.
    if (Math.abs(target.scrollTop - source.scrollTop) > 0.5) {
      target.scrollTop = source.scrollTop;
    }
  }, []);

  const onTimelineScroll = useCallback(() => {
    const source = timelineRef.current;
    const target = sidebarRef.current;
    if (!source || !target) return;

    if (Math.abs(target.scrollTop - source.scrollTop) > 0.5) {
      target.scrollTop = source.scrollTop;
    }
  }, []);

  return { sidebarRef, timelineRef, onSidebarScroll, onTimelineScroll };
}
