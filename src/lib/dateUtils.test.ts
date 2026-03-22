import { describe, it, expect } from 'vitest';
import { calculateEndDate, shiftDateByDays } from './dateUtils';

describe('Date Utilities Math Logic', () => {
  it('calculateEndDate adds duration correctly', () => {
    expect(calculateEndDate('2026-03-21', 5)).toBe('2026-03-26');
  });

  it('shiftDateByDays shifts dates correctly', () => {
    expect(shiftDateByDays('2026-03-21', 10)).toBe('2026-03-31');
    expect(shiftDateByDays('2026-03-21', -5)).toBe('2026-03-16');
  });
});
