import { useState, useRef, useEffect } from 'react';

interface UseResizablePanelOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  direction?: 'left' | 'right';
}

export function useResizablePanel({
  initialWidth = 450,
  minWidth = 250,
  maxWidth = 800,
  direction = 'left',
}: UseResizablePanelOptions = {}) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizingState, setIsResizingState] = useState(false);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.userSelect = 'none';
    
    // Add a class to body just in case we need it for global styling during drag
    document.body.classList.add('is-resizing');
  };

  useEffect(() => {
    // We use a mutable ref for animation frame to avoid multiple updates in the same frame
    let animationFrameId: number | null = null;
    let currentMouseX = 0;

    const updateWidth = () => {
      let newWidth: number;
      if (direction === 'left') {
        newWidth = currentMouseX - 16; // 16 is an offset for padding/margin
      } else {
        newWidth = window.innerWidth - currentMouseX - 16;
      }
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        if (panelRef.current) {
          panelRef.current.style.width = `${newWidth}px`;
        }
      }
      animationFrameId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      currentMouseX = e.clientX;
      
      // Batch DOM updates into the next animation frame for maximum performance
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateWidth);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing.current) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        
        isResizing.current = false;
        setIsResizingState(false);
        document.body.style.userSelect = '';
        document.body.classList.remove('is-resizing');
        
        // Sync final width to React state
        let newWidth: number;
        if (direction === 'left') {
          newWidth = e.clientX - 16;
        } else {
          newWidth = window.innerWidth - e.clientX - 16;
        }

        if (newWidth >= minWidth && newWidth <= maxWidth) {
           setWidth(newWidth);
        } else if (newWidth < minWidth) {
           setWidth(minWidth);
        } else if (newWidth > maxWidth) {
           setWidth(maxWidth);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth, direction]);

  return { width, isResizing: isResizingState, panelRef, onMouseDown };
}
