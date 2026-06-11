import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResizableTextarea } from './ResizableTextarea';

describe('ResizableTextarea', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the mobile resize grip with three bars', () => {
    render(<ResizableTextarea aria-label="Description" />);

    const wrapper = screen.getByLabelText('Description').parentElement;
    const bars = wrapper?.querySelectorAll('.textarea-resize-handle-bar');

    expect(wrapper?.classList.contains('resizable-textarea-wrapper')).toBe(true);
    expect(bars).toHaveLength(3);
  });

  it('resizes from the bottom grip for mouse pointers', () => {
    render(<ResizableTextarea aria-label="Description" />);

    const textarea = screen.getByLabelText('Description');
    const handle = textarea.parentElement?.querySelector('.textarea-resize-handle');

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ minHeight: '80px' } as CSSStyleDeclaration);
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({ height: 120 } as DOMRect);

    fireEvent.pointerDown(handle as Element, { pointerType: 'mouse', clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 155 });
    fireEvent.pointerUp(window);

    expect(textarea.style.height).toBe('175px');
  });
});
