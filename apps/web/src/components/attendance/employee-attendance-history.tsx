"use client";

import React from "react";
import { ArrowRight, CalendarDays, X, AlertCircle } from "lucide-react";
import type {
  EmployeeAttendanceHistoryFilter,
  EmployeeAttendanceHistoryProps,
} from "./types";
import { AttendanceTable } from "./attendance-table";
import { AttendanceTotalsCards } from "./attendance-totals-cards";
import { Button } from "@/components/ui/button";
import { ATTENDANCE_STATUS_OPTIONS } from "./attendance-filters";

export function EmployeeAttendanceHistory({
  employeeId,
  employeeName = "الموظف",
  departmentName,
  records,
  totals,
  filteredTotal,
  filter,
  onFilterChange,
  onBack,
  isLoading = false,
  error,
  isForbidden = false,
  onRetry,
  canOverride = false,
  onOverrideClick,
  page,
  pageSize,
  total,
  onPageChange,
}: EmployeeAttendanceHistoryProps) {
  const updateFilter = (field: keyof EmployeeAttendanceHistoryFilter, val: string) => {
    onFilterChange({
      ...filter,
      [field]: val,
    });
  };

  const hasActiveFilters = Boolean(filter.dateFrom || filter.dateTo || filter.status);
  const hasInvalidDateRange = Boolean(
    filter.dateFrom && filter.dateTo && filter.dateFrom > filter.dateTo
  );

  const clearFilters = () => {
    onFilterChange({
      dateFrom: "",
      dateTo: "",
      status: "",
    });
  };

  return (
    <section className="space-y-6" dir="rtl" data-testid="employee-attendance-history">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          data-testid="history-back-btn"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة لسجلات الحضور العامة</span>
        </button>
      </div>

      {/* Employee Profile Header & Summary */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <CalendarDays className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">
              سجل حضور {employeeName}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {departmentName ? `القسم: ${departmentName} — ` : ""}
              معرّف الموظف: <span className="font-mono">{employeeId}</span>
            </p>
          </div>
        </div>

        {/* Server Totals for Employee */}
        <div className="mt-6">
          <AttendanceTotalsCards
            totals={totals}
            filteredTotal={filteredTotal ?? total}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* History Records Section */}
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              السجل التاريخي للموظف
            </h3>
            <p className="text-xs text-muted-foreground">
              عرض سجلات الحضور والانصراف السابقة مع إمكانية التصفية بحسب التاريخ أو الحالة.
            </p>
          </div>
        </div>

        {/* Filters for Employee History */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label
              htmlFor="history-date-from"
              className="block text-xs font-medium text-muted-foreground"
            >
              من تاريخ
            </label>
            <input
              id="history-date-from"
              type="date"
              value={filter.dateFrom}
              max={filter.dateTo || undefined}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="history-date-from"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="history-date-to"
              className="block text-xs font-medium text-muted-foreground"
            >
              إلى تاريخ
            </label>
            <input
              id="history-date-to"
              type="date"
              value={filter.dateTo}
              min={filter.dateFrom || undefined}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="history-date-to"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="history-status"
              className="block text-xs font-medium text-muted-foreground"
            >
              الحالة
            </label>
            <select
              id="history-status"
              value={filter.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="history-status-select"
            >
              <option value="">كل الحالات</option>
              {ATTENDANCE_STATUS_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasInvalidDateRange && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            data-testid="history-date-range-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.</span>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              data-testid="history-clear-filters-btn"
            >
              <X className="h-3.5 w-3.5" />
              مسح الفلاتر
            </Button>
          </div>
        )}

        {/* History Table */}
        <AttendanceTable
          records={records}
          isLoading={isLoading}
          error={error}
          isForbidden={isForbidden}
          onRetry={onRetry}
          canOverride={canOverride}
          onOverrideClick={onOverrideClick}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}
