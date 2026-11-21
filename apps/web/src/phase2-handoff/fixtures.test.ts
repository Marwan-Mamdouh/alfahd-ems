import { describe, expect, it } from 'vitest';
import {
  employeeAttendanceHistory,
  emptyAttendance,
  filteredAttendance,
  inactiveProducts,
} from './fixtures';

describe('Phase 2 handoff fixtures', () => {
  it('shows filtered attendance card totals for an empty late result', () => {
    expect(employeeAttendanceHistory.filter.status).toBe('LATE');
    expect(employeeAttendanceHistory.data.value.page.total).toBe(0);
    expect(employeeAttendanceHistory.data.value.totals).toEqual({ total: 0, onTime: 0, late: 0 });
  });

  it('keeps empty attendance scenarios independent', () => {
    expect(filteredAttendance).toEqual(emptyAttendance);
    expect(filteredAttendance).not.toBe(emptyAttendance);
    expect(filteredAttendance.value.page).not.toBe(emptyAttendance.value.page);
  });

  it('provides a reactivation-ready inactive product', () => {
    expect(inactiveProducts.data.value.items[0].isActive).toBe(false);
    expect(inactiveProducts.capabilities.reactivate).toBe(true);
    expect(inactiveProducts.reactivation).toEqual({ pending: false, error: null });
    expect(inactiveProducts.onReactivate).toBeTypeOf('function');
  });
});
