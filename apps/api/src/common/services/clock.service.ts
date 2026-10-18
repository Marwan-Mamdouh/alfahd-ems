import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}

/**
 * Returns the calendar date (YYYY-MM-DD) for a given instant evaluated in the specified timezone (default 'Africa/Cairo').
 */
export function getLocalWorkDate(date: Date, timeZone = 'Africa/Cairo'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

/**
 * Checks whether the given date's local time in timeZone is strictly after cutoffTime ('HH:MM', default '09:00').
 */
export function isAfterCutoff(
  date: Date,
  cutoffTime = '09:00',
  timeZone = 'Africa/Cairo',
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hours = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const seconds = parseInt(parts.find((p) => p.type === 'second')!.value, 10);
  const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);

  if (hours > cutoffH) return true;
  if (hours < cutoffH) return false;
  if (minutes > cutoffM) return true;
  if (minutes < cutoffM) return false;
  return seconds > 0;
}
