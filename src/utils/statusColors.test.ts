import { describe, expect, it } from 'vitest';
import { getStatusChartColor, getStatusTextColor, registerStatuses } from './statusColors';

describe('statusColors', () => {
  it('returns text color classes for well-known statuses', () => {
    expect(getStatusTextColor('Todo')).toBe('text-slate-500');
    expect(getStatusTextColor('In progress')).toBe('text-yellow-600');
    expect(getStatusTextColor('Done')).toBe('text-purple-600');
  });

  it('returns text color classes from project-supplied status colors', () => {
    registerStatuses([{ name: 'Ready for deploy', color: 'GREEN' }]);

    expect(getStatusTextColor('Ready for deploy')).toBe('text-green-600');
    expect(getStatusChartColor('Ready for deploy')).toBe('#22c55e');
  });
});
