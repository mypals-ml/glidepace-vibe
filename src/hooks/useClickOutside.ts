import { useEffect, useCallback, type RefObject } from 'react';

/**
 * Calls `callback` when a click occurs outside the element referenced by `ref`.
 * Only active when `isActive` is true.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  isActive: boolean = true
) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    },
    [ref, callback]
  );

  useEffect(() => {
    if (isActive) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isActive, handleClick]);
}
