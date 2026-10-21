import { describe, it, expect } from 'vitest';
import { calculateHoursWorked } from './attendance.utils.js';

describe('calculateHoursWorked', () => {
  it('returns null when there is no check-out', () => {
    expect(calculateHoursWorked('2026-10-11T06:00:00Z')).toBeNull();
    expect(calculateHoursWorked('2026-10-11T06:00:00Z', null)).toBeNull();
  });

  it('computes hours rounded to 2 decimals', () => {
    expect(calculateHoursWorked('2026-10-11T06:00:00Z', '2026-10-11T14:30:00Z')).toBe(8.5);
    expect(calculateHoursWorked('2026-10-11T06:00:00Z', '2026-10-11T14:33:00Z')).toBe(8.55);
    expect(
      calculateHoursWorked(new Date('2026-10-11T06:00:00Z'), new Date('2026-10-11T06:00:00Z')),
    ).toBe(0);
    expect(
      calculateHoursWorked(new Date('2026-10-11T06:00:00Z'), new Date('2026-10-11T06:00:30Z')),
    ).toBe(0.01);
  });

  it('returns null for an invalid or inverted interval', () => {
    expect(calculateHoursWorked('not-a-date', '2026-10-11T14:00:00Z')).toBeNull();
    expect(calculateHoursWorked('2026-10-11T14:00:00Z', '2026-10-11T06:00:00Z')).toBeNull();
  });
});
