import { useState, useEffect } from 'react';

/**
 * Custom hook that tracks the state of a media query.
 * @param query The media query to track (e.g., '(min-width: 768px)')
 * @returns boolean true if the media query matches, false otherwise
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    
    // Update state when the media query changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Use the modern addEventListener if available, fallback to addListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
    } else {
      mediaQueryList.addListener(listener);
    }

    // Set initial value (handles case where query might have changed between initial state and effect)
    setMatches(mediaQueryList.matches);

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', listener);
      } else {
        mediaQueryList.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}
