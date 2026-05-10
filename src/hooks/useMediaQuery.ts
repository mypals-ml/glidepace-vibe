import { useSyncExternalStore } from 'react';

/**
 * Custom hook that tracks the state of a media query.
 * @param query The media query to track (e.g., '(min-width: 768px)')
 * @returns boolean true if the media query matches, false otherwise
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mediaQueryList = window.matchMedia(query);
    
    // Modern browser support
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', callback);
      return () => mediaQueryList.removeEventListener('change', callback);
    } 
    
    // Fallback for older browsers
    mediaQueryList.addListener(callback);
    return () => mediaQueryList.removeListener(callback);
  };

  const getSnapshot = () => window.matchMedia(query).matches;

  // For Server Side Rendering, if needed. Default to false or some reasonable value.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
