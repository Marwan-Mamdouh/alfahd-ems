import { describe, expect, it } from 'vitest';
import type { JobStatusResponseDto } from '@alfahd/types';
import type { ReportJob } from './interfaces';
import {
  employeeAttendanceHistory,
  emptyAttendance,
  filteredAttendance,
  inactiveProducts,
  managerSelector, unresolvedManager, loadingManagers, failedManagers, unrelatedWarehouseEdit,
  movementHistory, routerAudit, photoUnavailable, photoUploadRetry, completedReport, conflictingWarehouseForm, movementValidation,
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

  it('separates eligible manager choices from retained current-only assignments', () => {
    expect(managerSelector.options.value.map(({ role, status }) => [role, status])).toEqual([
      ['ADMIN', 'ACTIVE'], ['WAREHOUSE_STAFF', 'ACTIVE'],
    ]);
    expect(managerSelector.options.value.some(({ id }) => id === managerSelector.currentOnly.id)).toBe(false);
    expect(unresolvedManager.currentOnly).toEqual({ id: 'unknown', name: null, reason: 'unresolved' });
    expect(unrelatedWarehouseEdit).not.toHaveProperty('managerId');
    expect([loadingManagers.options.kind, failedManagers.options.kind, unresolvedManager.options.kind]).toEqual(['loading', 'error', 'empty']);
  });

  it('supplies historical names or an honest unresolved value', () => {
    expect(movementHistory.data.value.items[0].responsibleUser.name).toBe('Former employee');
    expect(movementHistory.data.value.items[0].technician).toBeNull();
    expect(movementHistory.data.value.items[1].technician).toEqual({ id: 'former-tech', name: null });
    expect(routerAudit.assignments.value[0].assignedByPerson.name).toBeNull();
    expect(routerAudit.assignments.value[0].technician).toBeNull();
    expect(routerAudit.assignments.value[1].technician).toEqual({ id: 'former-tech', name: 'Former technician' });
  });

  it('keeps photo retry, report download, and form feedback separate', () => {
    expect(photoUnavailable.photoUrl).toBeNull();
    expect(photoUploadRetry.employeeId).toBeTruthy();
    expect(photoUploadRetry.onRetryUpload).toBeTypeOf('function');
    expect(completedReport.job.id).toBe('example-report');
    expect(completedReport.download).not.toHaveProperty('jobId');
    expect(completedReport.download.onDownload).toBeTypeOf('function');
    expect(movementValidation.fieldErrors.newQuantity).toBeTruthy();
    expect(conflictingWarehouseForm.fieldErrors.name).toBeTruthy();
    expect(conflictingWarehouseForm.conflict).toBeTruthy();
    expect(inactiveProducts.actions.create.pending).toBe(false);
    expect(inactiveProducts.reactivation.error).toBeNull();
  });

  it('rejects invalid report state combinations at compile time', () => {
    if (false) {
      const download = completedReport.download;
      const pollingWithDownload = { kind: 'polling' as const, job: { id: 'a', status: 'RUNNING' as const }, download };
      // @ts-expect-error A polling report cannot expose a download.
      const invalidPolling: ReportJob = pollingWithDownload;
      const rawDto = {} as JobStatusResponseDto;
      // @ts-expect-error A wire DTO may carry downloadUrl and cannot enter presenter state.
      const invalidUrl: ReportJob = { kind: 'polling', job: rawDto };
      const otherJobDownload = { ...download, jobId: 'different-job' };
      // @ts-expect-error Download cannot carry a second, potentially mismatched ID.
      const invalidId: ReportJob = { ...completedReport, download: otherJobDownload };
      void [invalidPolling, invalidUrl, invalidId];
    }
  });
});
