/**
 * Utility functions for date/time operations with Vietnam timezone (UTC+7)
 * 
 * Note: PostgreSQL connection is configured with timezone = 'Asia/Ho_Chi_Minh'
 * This means all NOW() and CURRENT_TIMESTAMP functions in the database will use Vietnam timezone.
 * 
 * When creating Date objects in JavaScript code, we use these utilities to ensure
 * consistency with the database timezone settings.
 */

/**
 * Get current date/time
 * Since PostgreSQL is configured with Vietnam timezone, this returns current time
 * which will be correctly interpreted by the database.
 * 
 * @returns Date object representing current time
 */
export function getVietnamTime(): Date {
  return new Date();
}

/**
 * Get current date/time - alias for getVietnamTime()
 * @returns Date object for current time
 */
export function now(): Date {
  return getVietnamTime();
}

/**
 * Get start of day (00:00:00) in Vietnam timezone
 * @param date - Date to get start of day for (defaults to today)
 * @returns Date object representing start of day (00:00:00)
 */
export function getStartOfDayVietnam(date?: Date): Date {
  const baseDate = date || new Date();
  const startOfDay = new Date(baseDate);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Get start of week (Monday 00:00:00) in Vietnam timezone
 * @param date - Date to get week start for (defaults to today)
 * @returns Date object representing start of week (Monday 00:00:00)
 */
export function getWeekStartVietnam(date?: Date): Date {
  const baseDate = date || new Date();
  const day = baseDate.getDay();
  // Calculate days to subtract to get to Monday
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = day === 0 ? 6 : day - 1; // If Sunday, go back 6 days; otherwise go back (day-1) days
  
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

