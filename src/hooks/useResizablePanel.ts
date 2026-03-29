import { useState, useRef, useEffect } from 'react';

interface UseResizablePanelOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function useResizablePanel({
  initialWidth = 450,
  minWidth = 250,
  maxWidth = 800,
}: UseResizablePanelOptions = {}) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX - 16;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth]);

  return { width, onMouseDown };
}
