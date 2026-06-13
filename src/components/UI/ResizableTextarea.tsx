import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type TextareaHTMLAttributes } from 'react';

type ResizableTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  resizeHandleLabel: string;
};

export const ResizableTextarea = forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(function ResizableTextarea(
  { className = '', resizeHandleLabel, style, ...props },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [touchHeight, setTouchHeight] = useState<number | null>(null);

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

  const getMinHeight = (textarea: HTMLTextAreaElement) => {
    return parseFloat(window.getComputedStyle(textarea).minHeight || '0') || 0;
  };

  const resizeBy = (deltaY: number) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const currentHeight = touchHeight ?? textarea.getBoundingClientRect().height;
    setTouchHeight(Math.max(getMinHeight(textarea), Math.round(currentHeight + deltaY)));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!textareaRef.current) return;

    event.preventDefault();

    const textarea = textareaRef.current;
    const minHeight = getMinHeight(textarea);
    const startY = event.clientY;
    const startHeight = textarea.getBoundingClientRect().height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setTouchHeight(Math.max(minHeight, Math.round(startHeight + deltaY)));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      resizeBy(event.shiftKey ? 40 : 10);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      resizeBy(event.shiftKey ? -40 : -10);
    }
  };

  return (
    <div className="resizable-textarea-wrapper">
      <textarea
        {...props}
        ref={textareaRef}
        className={className}
        style={{
          ...style,
          ...(touchHeight ? { height: `${touchHeight}px` } : null),
        }}
      />
      <button
        type="button"
        className="textarea-resize-handle"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        aria-label={resizeHandleLabel}
      >
        <span className="textarea-resize-handle-bar" />
      </button>
    </div>
  );
});
