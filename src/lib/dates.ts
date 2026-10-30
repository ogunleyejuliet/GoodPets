// Good Pets - Date & Time Utilities (Africa/Lagos)
// Single Source of Truth: PRD section 8.5, BR-010, BR-037, BR-043

export const LAGOS_TIMEZONE = 'Africa/Lagos';

export const GROOMING_SLOTS = [
  {
    slotCode: '09:00',
    startTime: '09:00',
    endTime: '10:30',
    label: '9:00 AM – 10:30 AM',
    durationMinutes: 90,
  },
  {
    slotCode: '12:00',
    startTime: '12:00',
    endTime: '13:30',
    label: '12:00 PM – 1:30 PM',
    durationMinutes: 90,
  },
  {
    slotCode: '15:00',
    startTime: '15:00',
    endTime: '16:30',
    label: '3:00 PM – 4:30 PM',
    durationMinutes: 90,
  },
] as const;

/**
 * Returns today's date in Africa/Lagos as 'YYYY-MM-DD'.
 */
export function getTodayLagosString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // en-CA outputs YYYY-MM-DD
}

/**
 * Returns the earliest selectable service date in Africa/Lagos.
 * BR-043: Earliest service date for a new booking is the next Lagos calendar day.
 */
export function getEarliestServiceDateLagos(): string {
  const todayStr = getTodayLagosString();
  return addDaysToDateString(todayStr, 1);
}

/**
 * Adds an integer number of days to a 'YYYY-MM-DD' date string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split('T')[0];
}

/**
 * Validates whether a string matches 'YYYY-MM-DD'.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Counts inclusive calendar days between two dates.
 * Daycare rule: Nov 1 to Nov 1 = 1 day; Nov 1 to Nov 3 = 3 days.
 */
export function countDaycareDays(startDateStr: string, endDateStr: string): number {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays + 1 : 0;
}

/**
 * Counts nights between check-in and check-out.
 * Boarding rule: Dec 20 to Dec 27 = 7 nights.
 */
export function countBoardingNights(checkInDateStr: string, checkOutDateStr: string): number {
  const [sy, sm, sd] = checkInDateStr.split('-').map(Number);
  const [ey, em, ed] = checkOutDateStr.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Generates an array of 'YYYY-MM-DD' dates between start and end inclusive.
 */
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  let current = startDateStr;
  while (current <= endDateStr) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
  }
  return dates;
}

