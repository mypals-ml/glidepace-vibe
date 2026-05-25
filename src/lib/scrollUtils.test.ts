import { describe, expect, it } from 'vitest';
import { getScrollTopForSelectedRow } from './scrollUtils';

describe('getScrollTopForSelectedRow', () => {
  it('preserves scroll when the selected row is fully visible', () => {
    expect(getScrollTopForSelectedRow({
      currentScrollTop: 144,
      rowIndex: 3,
      rowHeight: 72,
      viewportHeight: 288,
    })).toBe(144);
  });

  it('preserves scroll when the selected row is partially visible', () => {
    expect(getScrollTopForSelectedRow({
      currentScrollTop: 250,
      rowIndex: 3,
      rowHeight: 72,
      viewportHeight: 288,
    })).toBe(250);
  });

  it('centers rows above the current viewport', () => {
    expect(getScrollTopForSelectedRow({
      currentScrollTop: 360,
      rowIndex: 1,
      rowHeight: 72,
      viewportHeight: 288,
    })).toBe(0);
  });

  it('centers rows below the current viewport', () => {
    expect(getScrollTopForSelectedRow({
      currentScrollTop: 0,
      rowIndex: 8,
      rowHeight: 72,
      viewportHeight: 288,
    })).toBe(468);
  });
});
