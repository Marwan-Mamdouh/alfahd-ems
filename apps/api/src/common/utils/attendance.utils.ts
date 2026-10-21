const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Computes hours worked between a check-in and a check-out, rounded to 2
 * decimals. Returns `null` when there is no check-out yet or the interval is
 * invalid (unknown date or check-out before check-in).
 *
 * Single source of truth for `hoursWorked`: used by `AttendanceService.checkOut`,
 * `AttendanceService.override`, and `AttendanceReportWorker`.
 */
export function calculateHoursWorked(
  checkIn: Date | string,
  checkOut?: Date | string | null,
): number | null {
  if (checkOut == null) return null;
  const inMs = new Date(checkIn).getTime();
  const outMs = new Date(checkOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs < inMs) return null;
  return Math.round(((outMs - inMs) / MS_PER_HOUR) * 100) / 100;
}
