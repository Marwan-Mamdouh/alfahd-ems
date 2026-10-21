import { describe, it, expect } from 'vitest';
import {
  ClockService,
  formatLocalTimestamp,
  getLocalWorkDate,
  isAfterCutoff,
} from './clock.service.js';

describe('ClockService & Timezone Helpers', () => {
  it('ClockService returns current date instance', () => {
    const clock = new ClockService();
    const now = clock.now();
    expect(now).toBeInstanceOf(Date);
  });

  describe('getLocalWorkDate', () => {
    it('evaluates calendar work date in Africa/Cairo across midnight boundaries in winter (UTC+2)', () => {
      // In January (winter), Cairo is UTC+2.
      // 2026-01-15T21:59:00.000Z is 23:59:00 in Cairo -> 2026-01-15
      const d1 = new Date('2026-01-15T21:59:00.000Z');
      expect(getLocalWorkDate(d1)).toBe('2026-01-15');

      // 2026-01-15T22:01:00.000Z is 00:01:00 in Cairo -> 2026-01-16
      const d2 = new Date('2026-01-15T22:01:00.000Z');
      expect(getLocalWorkDate(d2)).toBe('2026-01-16');
    });

    it('evaluates calendar work date in Africa/Cairo across midnight boundaries in summer DST (UTC+3)', () => {
      // In July (summer DST), Cairo is UTC+3.
      // 2026-07-15T20:59:00.000Z is 23:59:00 in Cairo -> 2026-07-15
      const d1 = new Date('2026-07-15T20:59:00.000Z');
      expect(getLocalWorkDate(d1)).toBe('2026-07-15');

      // 2026-07-15T21:01:00.000Z is 00:01:00 in Cairo -> 2026-07-16
      const d2 = new Date('2026-07-15T21:01:00.000Z');
      expect(getLocalWorkDate(d2)).toBe('2026-07-16');
    });

    it('returns identical output across repeated calls with the cached formatter (HARD-01)', () => {
      // The formatter instance is now cached per timezone for hot check-in/
      // check-out paths — caching must not change the produced dates.
      const d = new Date('2026-10-11T06:00:00.000Z');
      const fresh = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const results = new Set(Array.from({ length: 50 }, () => getLocalWorkDate(d)));
      expect([...results]).toHaveLength(1);
      expect([...results][0]).toBe(fresh.format(d));
      expect(getLocalWorkDate(d)).toBe('2026-10-11');
    });
  });

  describe('isAfterCutoff', () => {
    it('accurately identifies on-time vs late across the 09:00 cutoff in winter (UTC+2)', () => {
      // 09:00 Cairo in winter (UTC+2) is 07:00 UTC
      const beforeCutoff = new Date('2026-01-15T06:59:59.000Z'); // 08:59:59 Cairo
      const exactCutoff = new Date('2026-01-15T07:00:00.000Z'); // 09:00:00 Cairo
      const afterCutoff = new Date('2026-01-15T07:00:01.000Z'); // 09:00:01 Cairo
      const lateTime = new Date('2026-01-15T07:30:00.000Z'); // 09:30:00 Cairo

      expect(isAfterCutoff(beforeCutoff, '09:00')).toBe(false);
      expect(isAfterCutoff(exactCutoff, '09:00')).toBe(false);
      expect(isAfterCutoff(afterCutoff, '09:00')).toBe(true);
      expect(isAfterCutoff(lateTime, '09:00')).toBe(true);
    });

    it('accurately identifies on-time vs late across the 09:00 cutoff in summer DST (UTC+3)', () => {
      // 09:00 Cairo in summer DST (UTC+3) is 06:00 UTC
      const beforeCutoff = new Date('2026-07-15T05:59:59.000Z'); // 08:59:59 Cairo
      const exactCutoff = new Date('2026-07-15T06:00:00.000Z'); // 09:00:00 Cairo
      const afterCutoff = new Date('2026-07-15T06:00:01.000Z'); // 09:00:01 Cairo

      expect(isAfterCutoff(beforeCutoff, '09:00')).toBe(false);
      expect(isAfterCutoff(exactCutoff, '09:00')).toBe(false);
      expect(isAfterCutoff(afterCutoff, '09:00')).toBe(true);
    });
  });

  describe('formatLocalTimestamp', () => {
    it('renders Cairo wall-clock time instead of a UTC ISO string (HARD-09)', () => {
      // 06:00Z in July (Cairo DST, UTC+3) = 09:00:00 local — the hour staff
      // actually started, not the UTC value.
      expect(formatLocalTimestamp(new Date('2026-07-15T06:00:00Z'))).toBe('15/07/2026, 09:00:00');
      expect(formatLocalTimestamp('2026-07-15T06:00:00Z')).toBe('15/07/2026, 09:00:00');
    });

    it('honours an explicit timezone and stays stable across cached calls', () => {
      expect(formatLocalTimestamp('2026-07-15T06:00:00Z', 'UTC')).toBe('15/07/2026, 06:00:00');
      expect(formatLocalTimestamp('2026-07-15T06:00:00Z')).toBe(
        formatLocalTimestamp('2026-07-15T06:00:00Z'),
      );
    });

    it("returns '-' for unparseable input", () => {
      expect(formatLocalTimestamp('not-a-date')).toBe('-');
      expect(formatLocalTimestamp('')).toBe('-');
    });
  });
});
