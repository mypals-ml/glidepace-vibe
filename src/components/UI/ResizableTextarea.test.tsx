import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResizableTextarea } from './ResizableTextarea';

describe('ResizableTextarea', () => {
  it('renders the mobile resize grip with three bars', () => {
    render(<ResizableTextarea aria-label="Description" />);

    const wrapper = screen.getByLabelText('Description').parentElement;
    const bars = wrapper?.querySelectorAll('.textarea-resize-handle-bar');

    expect(wrapper?.classList.contains('resizable-textarea-wrapper')).toBe(true);
    expect(bars).toHaveLength(3);
  });
});
