import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import config from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

const APP_TZ = config.app.timezone;

/**
 * Get the current date in the app timezone as YYYY-MM-DD
 */
export const getTodayDate = () => {
  return dayjs().tz(APP_TZ).format('YYYY-MM-DD');
};

/**
 * Get the current time in the app timezone as HH:mm
 */
export const getCurrentTime = () => {
  return dayjs().tz(APP_TZ).format('HH:mm');
};

/**
 * Get current ISO datetime in the app timezone
 */
export const getCurrentDateTime = () => {
  return {
    date: getTodayDate(),
    time: getCurrentTime(),
    timezone: APP_TZ,
    isoString: dayjs().tz(APP_TZ).toISOString(),
  };
};

/**
 * Check if a date string (YYYY-MM-DD) is in the future or today
 */
export const isDateValid = (dateStr) => {
  const today = getTodayDate();
  return dateStr >= today;
};

/**
 * Check if a date+time combo is in the future
 */
export const isDateTimeInFuture = (dateStr, timeStr) => {
  const now = dayjs().tz(APP_TZ);
  const dt = dayjs.tz(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', APP_TZ);
  return dt.isAfter(now);
};

/**
 * Add days to a date string
 */
export const addDays = (dateStr, days) => {
  return dayjs.tz(dateStr, APP_TZ).add(days, 'day').format('YYYY-MM-DD');
};

/**
 * Get a range of dates starting from dateStr
 */
export const getDateRange = (startDate, numDays) => {
  const dates = [];
  for (let i = 0; i < numDays; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
};

/**
 * Check if two time strings overlap
 */
export const timeInRange = (time, rangeStart, rangeEnd) => {
  return time >= rangeStart && time < rangeEnd;
};

/**
 * Format a date for display
 */
export const formatDateDisplay = (dateStr) => {
  return dayjs.tz(dateStr, APP_TZ).format('D MMMM YYYY');
};

/**
 * Format a time for display (24h → "5:00 PM")
 */
export const formatTimeDisplay = (timeStr) => {
  return dayjs(`2000-01-01 ${timeStr}`, 'YYYY-MM-DD HH:mm').format('h:mm A');
};

/**
 * Validate HH:mm format and that start < end
 */
export const validateTimeRange = (startTime, endTime) => {
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return false;
  return startTime < endTime;
};
