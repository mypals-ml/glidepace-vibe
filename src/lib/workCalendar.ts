export interface WorkCalendar {
  id: string;
  name: string;
  timeZone: string;
  formatDate: (date: Date | string) => string;
  isWorkday: (date: Date | string) => boolean;
  isNonWorkday: (date: Date | string) => boolean;
  addWorkdays: (date: Date | string, days: number) => string;
  diffWorkdays: (startDate: Date | string, endDate: Date | string) => number;
}

export function getCurrentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatWorkCalendarDate(date: Date | string): string {
  if (!date) return '';

  if (typeof date === 'string') {
    const dateOnlyMatch = date.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateOnlyMatch) return date;
  }

  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseCalendarDate(date: Date | string): Date | null {
  if (!date) return null;

  if (date instanceof Date) {
    return Number.isNaN(date.getTime())
      ? null
      : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCalendarDay(date: Date | string): number | null {
  const parsed = parseCalendarDate(date);
  if (!parsed) return null;

  return parsed.getUTCDay();
}

function addDays(date: Date, days: number): void {
  date.setUTCDate(date.getUTCDate() + days);
}

export const defaultWorkCalendar: WorkCalendar = {
  id: 'default',
  name: 'Default Work Calendar',
  timeZone: getCurrentTimeZone(),

  formatDate(date) {
    return formatWorkCalendarDate(date);
  },

  isWorkday(date) {
    const day = getCalendarDay(date);
    if (day === null) return false;
    return day >= 1 && day <= 5;
  },

  isNonWorkday(date) {
    return !this.isWorkday(date);
  },

  addWorkdays(date, days) {
    const startDate = parseCalendarDate(date);
    if (!startDate) return '';
    if (days === 0) return this.formatDate(date);

    const direction = days > 0 ? 1 : -1;
    const targetCount = Math.abs(days);
    const current = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    ));

    let count = 0;
    while (count < targetCount) {
      addDays(current, direction);
      if (this.isWorkday(this.formatDate(current))) {
        count++;
      }
    }

    return this.formatDate(current);
  },

  diffWorkdays(startDate, endDate) {
    const start = parseCalendarDate(startDate);
    const end = parseCalendarDate(endDate);
    if (!start || !end) return 0;

    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const final = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    if (current > final) return 0;

    let count = 0;
    while (current <= final) {
      if (this.isWorkday(this.formatDate(current))) {
        count++;
      }
      addDays(current, 1);
    }

    return count;
  },
};
