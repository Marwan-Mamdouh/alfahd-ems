import { describe, it, expect } from 'vitest';
import { ClockService, getLocalWorkDate, isAfterCutoff } from './clock.service.js';

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
});
