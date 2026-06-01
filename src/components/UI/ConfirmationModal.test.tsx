import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from './ConfirmationModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('ConfirmationModal', () => {
  it('shows a loading animation on the confirm button while confirming', () => {
    const { container } = render(
      <ConfirmationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete"
        message="Delete this comment?"
        confirmLabel="Delete"
        variant="danger"
        isConfirming
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    const spinner = deleteButton.querySelector('svg.animate-spin');

    expect(deleteButton.hasAttribute('disabled')).toBe(true);
    expect(spinner).not.toBeNull();
    expect(container.textContent).not.toContain('...');
  });
});
