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
