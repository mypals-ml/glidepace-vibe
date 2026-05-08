/**
 * Core logical algorithms for date cascading/math logic.
 * These functions calculate start/end dates for dependent tasks.
 */

export function calculateTargetDate(startDate: string, durationDays: number): string {
  if (!startDate || durationDays < 0) return startDate;
  
  const d = new Date(startDate);
  // Add duration in days. Duration of 1 day means end date is the same as start date or next day depending on convention.
  // Assuming simple addition: end_date = start_date + durationDays
  d.setDate(d.getDate() + durationDays);
  
  return d.toISOString().split('T')[0];
}

export function shiftDateByDays(date: string, shiftDays: number): string {
  if (!date) return date;
  
  const d = new Date(date);
  d.setDate(d.getDate() + shiftDays);
  
  return d.toISOString().split('T')[0];
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
