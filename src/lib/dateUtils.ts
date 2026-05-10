/**
 * Core logical algorithms for date cascading/math logic.
 * These functions calculate start/end dates for dependent tasks.
 */

/**
 * Converts an estimate value and unit into an equivalent number of days.
 * Current rules:
 * - Hours: 8 hours = 1 day (rounded up)
 * - Points/Days/Other: 1 unit = 1 day
 */
export function convertEstimateToDays(estimate: number, unit: string = 'days'): number {
  if (!estimate || estimate <= 0) return 0;
  
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit.includes('hour')) {
    return Math.ceil(estimate / 8);
  }
  
  // Default: 1 unit = 1 day (for points, days, etc.)
  return Math.ceil(estimate);
}

export function calculateTargetDate(startDate: string, estimate: number, unit: string = 'days'): string {
  if (!startDate) return startDate;
  
  const durationDays = convertEstimateToDays(estimate, unit);
  const d = new Date(startDate);
  
  // If duration is 0 or 1, the target date might be the same as start date 
  // depending on if we treat "1 day" as "starts and ends today".
  // For most project management tools, duration of 1 means targetDate = startDate.
  // We'll use: targetDate = startDate + (duration - 1) days, but at least startDate.
  const shift = Math.max(0, durationDays - 1);
  d.setDate(d.getDate() + shift);
  
  return d.toISOString().split('T')[0];
}

export function shiftDateByDays(date: string, shiftDays: number): string {
  if (!date) return date;
  
  const d = new Date(date);
  d.setDate(d.getDate() + shiftDays);
  
  return d.toISOString().split('T')[0];
}

export function calculateStartDate(targetDate: string, estimate: number, unit: string = 'days'): string {
  if (!targetDate) return targetDate;
  
  const durationDays = convertEstimateToDays(estimate, unit);
  const shift = Math.max(0, durationDays - 1);
  return shiftDateByDays(targetDate, -shift);
}

export function diffDays(startDate: string, targetDate: string): number {
  if (!startDate || !targetDate) return 0;
  const start = new Date(startDate);
  const target = new Date(targetDate);
  const diffTime = Math.abs(target.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because start and end on same day = 1 day duration
}

/**
 * Formats a date or string to GitHub's required YYYY-MM-DD format.
 * Uses UTC extraction to avoid timezone-induced day shifts.
 */
export function formatToGitHubDate(date: Date | string): string {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    
    // toISOString always returns UTC time, giving us the pure calendar date
    // for GitHub Project V2 date fields without local timezone offsets.
    return d.toISOString().split('T')[0];
  } catch (e) {
    console.error('Error formatting date for GitHub:', e);
    return '';
  }
}
