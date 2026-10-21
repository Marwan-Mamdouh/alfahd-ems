import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}

/** Formatters are expensive to build; cache one per timezone. */
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Returns the calendar date (YYYY-MM-DD) for a given instant evaluated in the specified timezone (default 'Africa/Cairo').
 *
 * The `Intl.DateTimeFormat` instance is cached per timezone: every check-in and
 * check-out calls this, and formatter construction dwarfs `format()` itself.
 */
export function getLocalWorkDate(date: Date, timeZone = 'Africa/Cairo'): string {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter.format(date); // YYYY-MM-DD
}

function localTimeString(date: Date, timeZone: string): string {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23', // zero-padded 24h → "HH:MM:SS", lexicographic order == time order
    });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter.format(date);
}

/**
 * Checks whether the given date's local time in timeZone is strictly after cutoffTime ('HH:MM', default '09:00').
 */
export function isAfterCutoff(
  date: Date,
  cutoffTime = '09:00',
  timeZone = 'Africa/Cairo',
): boolean {
  const cutoff = cutoffTime.length === 5 ? `${cutoffTime}:00` : cutoffTime;
  return localTimeString(date, timeZone) > cutoff;
}

/** Full date+time formatters (one per timezone) for report rendering. */
const timestampFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats an instant as a local wall-clock timestamp ("DD/MM/YYYY, HH:MM:SS",
 * 24h) in the given timezone — reports read as operational Cairo hours instead
 * of shifted UTC ISO strings ("06:00:00Z" for a 09:00 Cairo start).
 * Returns '-' for unparseable input.
 */
export function formatLocalTimestamp(date: Date | string, timeZone = 'Africa/Cairo'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  let formatter = timestampFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    timestampFormatters.set(timeZone, formatter);
  }
  return formatter.format(d);
}
