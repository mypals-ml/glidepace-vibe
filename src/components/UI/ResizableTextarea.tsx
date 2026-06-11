import { forwardRef, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type TextareaHTMLAttributes } from 'react';

type ResizableTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const ResizableTextarea = forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(function ResizableTextarea(
  { className = '', style, ...props },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [touchHeight, setTouchHeight] = useState<number | null>(null);

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!textareaRef.current) return;

    event.preventDefault();

    const textarea = textareaRef.current;
    const minHeight = parseFloat(window.getComputedStyle(textarea).minHeight || '0') || 0;
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
      <div
        className="textarea-resize-handle"
        onPointerDown={handlePointerDown}
        aria-hidden="true"
      >
        <span className="textarea-resize-handle-bar" />
        <span className="textarea-resize-handle-bar" />
        <span className="textarea-resize-handle-bar" />
      </div>
    </div>
  );
});
