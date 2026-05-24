import { describe, expect, it } from 'vitest';
import { createRecentLocalReorderTracker } from './reorderSyncUtils';

describe('createRecentLocalReorderTracker', () => {
  it('matches a recently marked reorder throughout the guard window', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume('item-1', 500)).toBe(true);
    expect(tracker.consume('item-1', 500)).toBe(true);
  });

  it('does not consume expired reorder marks', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume('item-1', 1201)).toBe(false);
  });

  it('ignores unknown or missing item ids', () => {
    const tracker = createRecentLocalReorderTracker(1000);

    tracker.mark(['item-1'], 100);

    expect(tracker.consume(undefined, 500)).toBe(false);
    expect(tracker.consume('item-2', 500)).toBe(false);
  });
});
