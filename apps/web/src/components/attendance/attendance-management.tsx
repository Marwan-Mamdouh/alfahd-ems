"use client";

import React, { useState } from "react";
import {
  CalendarCheck,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { OverrideAttendanceDto } from "@alfahd/types";
import type {
  AttendanceProps,
  AttendanceRow,
  EmployeeAttendanceHistoryFilter,
} from "./types";
import { AttendanceTotalsCards } from "./attendance-totals-cards";
import { AttendanceFilters } from "./attendance-filters";
import { AttendanceTable } from "./attendance-table";
import { AttendanceOverrideDialog } from "./attendance-override-dialog";
import { AttendanceExportDialog } from "./attendance-export-dialog";
import { EmployeeAttendanceHistory } from "./employee-attendance-history";
import { Button } from "@/components/ui/button";

export function AttendanceManagement({
  data,
  filter,
  capabilities,
  onFilterChange,
  onPageChange,
  job = { kind: "idle" },
  onOverride,
  onExportRequest,
  onDownload,
}: AttendanceProps) {
  // Modal states
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [selectedRecordForOverride, setSelectedRecordForOverride] =
    useState<AttendanceRow | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);

  // Selected employee for history drilldown
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [selectedEmployeeDept, setSelectedEmployeeDept] = useState<string>("");

  const [historyFilter, setHistoryFilter] = useState<EmployeeAttendanceHistoryFilter>({
    dateFrom: "",
    dateTo: "",
    status: "",
  });

  const isLoading = data.kind === "loading";
  const isError = data.kind === "error";
  const isForbidden = data.kind === "forbidden";
  const isReady = data.kind === "ready";

  const pageData = isReady ? data.value.page : null;
  const records = pageData ? [...pageData.items] : [];
  const totals = isReady ? data.value.totals : null;
  const totalCount = pageData ? pageData.total : 0;
  const currentPage = pageData ? pageData.page : 1;
  const pageSize = pageData ? pageData.pageSize : 20;

  // Handle opening override modal
  const handleOpenOverride = (record: AttendanceRow) => {
    setSelectedRecordForOverride(record);
    setOverrideError(null);
    setIsOverrideOpen(true);
  };

  const handleCloseOverride = () => {
    setIsOverrideOpen(false);
    setSelectedRecordForOverride(null);
    setOverrideError(null);
  };

  const handleSubmitOverride = async (id: string, payload: OverrideAttendanceDto) => {
    if (!onOverride) return;
    try {
      setIsOverriding(true);
      setOverrideError(null);
      await onOverride(id, payload);
      handleCloseOverride();
    } catch (err) {
      setOverrideError(
        err instanceof Error ? err.message : "فشل حفظ التعديل الإداري للسجل."
      );
    } finally {
      setIsOverriding(false);
    }
  };

  // Handle drilldown into employee history
  const handleRecordClick = (record: AttendanceRow) => {
    const empId = record.userId || record.employeeId;
    if (empId) {
      setSelectedEmployeeId(empId);
      setSelectedEmployeeName(record.employeeName);
      setSelectedEmployeeDept(record.department ?? "");
      setHistoryFilter({
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        status: "",
      });
    }
  };

  const handleBackFromHistory = () => {
    setSelectedEmployeeId(null);
  };

  // Filter records for employee history when in drilldown mode
  const employeeHistoryRecords = selectedEmployeeId
    ? records.filter((r) => {
        const matchesEmployee = (r.userId || r.employeeId) === selectedEmployeeId;
        const recordDate = r.workDate || r.date;
        const matchesDateFrom = !historyFilter.dateFrom || (recordDate && recordDate >= historyFilter.dateFrom);
        const matchesDateTo = !historyFilter.dateTo || (recordDate && recordDate <= historyFilter.dateTo);
        const matchesStatus = !historyFilter.status || r.status === historyFilter.status;
        return matchesEmployee && matchesDateFrom && matchesDateTo && matchesStatus;
      })
    : [];

  // Employee history totals
  const employeeHistoryTotals = selectedEmployeeId && totals
    ? {
        total: employeeHistoryRecords.length,
        onTime: employeeHistoryRecords.filter((r) => r.status === "ON_TIME").length,
        late: employeeHistoryRecords.filter((r) => r.status === "LATE").length,
      }
    : null;

  return (
    <div className="space-y-6" dir="rtl" data-testid="attendance-management">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <CalendarCheck className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة الحضور والانصراف</h1>
              <p className="mt-1 text-xs text-white/85">
                متابعة سجلات الحضور والانصراف، إدارة التعديلات الرقابية، وتصدير التقارير المعتمدة
              </p>
            </div>
          </div>

          {capabilities.export && (
            <Button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 bg-white text-teal-800 hover:bg-white/90 font-medium shadow-sm"
              data-testid="open-export-dialog-btn"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>تصدير تقرير Excel</span>
            </Button>
          )}
        </div>

        <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-white/5" aria-hidden="true" />
      </div>

      {/* Main Content: Drilldown view or Main list */}
      {selectedEmployeeId ? (
        <EmployeeAttendanceHistory
          employeeId={selectedEmployeeId}
          employeeName={selectedEmployeeName}
          departmentName={selectedEmployeeDept}
          records={employeeHistoryRecords}
          totals={employeeHistoryTotals}
          filteredTotal={employeeHistoryRecords.length}
          filter={historyFilter}
          onFilterChange={setHistoryFilter}
          onBack={handleBackFromHistory}
          isLoading={isLoading}
          error={isError ? new Error(data.message) : null}
          isForbidden={isForbidden}
          canOverride={capabilities.override}
          onOverrideClick={handleOpenOverride}
        />
      ) : (
        <>
          {/* Server Totals Cards */}
          <AttendanceTotalsCards
            totals={totals}
            filteredTotal={totalCount}
            isLoading={isLoading}
          />

          {/* Records & Filters Section */}
          <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  سجلات الحضور والانصراف
                </h2>
                <p className="text-xs text-muted-foreground">
                  استعرض السجلات، وقم بالتصفية أو اضغط على أي موظف لعرض سجله التاريخي المنفصل.
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <AttendanceFilters
              value={filter}
              onChange={onFilterChange}
              disabled={isLoading || isForbidden}
            />

            {/* Error Banner if error state */}
            {isError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
                data-testid="attendance-error-banner"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{data.message}</span>
                </div>
                {data.retry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={data.retry}
                    className="gap-1.5 text-xs border-red-300 bg-white hover:bg-red-50 dark:bg-transparent"
                    data-testid="attendance-retry-btn"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>إعادة المحاولة</span>
                  </Button>
                )}
              </div>
            )}

            {/* Table */}
            <AttendanceTable
              records={records}
              isLoading={isLoading}
              error={isError ? new Error(data.message) : null}
              isForbidden={isForbidden}
              forbiddenMessage={isForbidden ? data.message : undefined}
              onRetry={isError ? data.retry : undefined}
              onRecordClick={handleRecordClick}
              canOverride={capabilities.override}
              onOverrideClick={handleOpenOverride}
              page={currentPage}
              pageSize={pageSize}
              total={totalCount}
              onPageChange={onPageChange}
            />
          </section>
        </>
      )}

      {/* Admin Override Dialog */}
      <AttendanceOverrideDialog
        record={selectedRecordForOverride}
        isOpen={isOverrideOpen}
        isSubmitting={isOverriding}
        errorMessage={overrideError}
        onClose={handleCloseOverride}
        onSubmit={handleSubmitOverride}
      />

      {/* Export Report Dialog */}
      {capabilities.export && (
        <AttendanceExportDialog
          isOpen={isExportOpen}
          job={job}
          onClose={() => setIsExportOpen(false)}
          onRequestExport={async (params) => {
            if (onExportRequest) {
              await onExportRequest(params);
            }
          }}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}
