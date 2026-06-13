import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResizableTextarea } from './ResizableTextarea';

describe('ResizableTextarea', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a lower-border resize handle with a centered grip', () => {
    render(<ResizableTextarea aria-label="Description" resizeHandleLabel="Resize text field" />);

    const wrapper = screen.getByLabelText('Description').parentElement;
    const bars = wrapper?.querySelectorAll('.textarea-resize-handle-bar');
    const handle = wrapper?.querySelector('.textarea-resize-handle');

    expect(wrapper?.classList.contains('resizable-textarea-wrapper')).toBe(true);
    expect(handle?.tagName).toBe('BUTTON');
    expect(bars).toHaveLength(1);
  });

  it('resizes from the bottom grip for mouse pointers', () => {
    render(<ResizableTextarea aria-label="Description" resizeHandleLabel="Resize text field" />);

    const textarea = screen.getByLabelText('Description');
    const handle = textarea.parentElement?.querySelector('.textarea-resize-handle');

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ minHeight: '80px' } as CSSStyleDeclaration);
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({ height: 120 } as DOMRect);

    fireEvent.pointerDown(handle as Element, { pointerType: 'mouse', clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 155 });
    fireEvent.pointerUp(window);

    expect(textarea.style.height).toBe('175px');
  });

  it('resizes from the bottom grip with arrow keys', () => {
    render(<ResizableTextarea aria-label="Description" resizeHandleLabel="Resize text field" />);

    const textarea = screen.getByLabelText('Description');
    const handle = screen.getByLabelText('Resize text field');

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ minHeight: '80px' } as CSSStyleDeclaration);
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({ height: 120 } as DOMRect);

    fireEvent.keyDown(handle, { key: 'ArrowDown' });

    expect(textarea.style.height).toBe('130px');
  });
});
