"use client";

import React from "react";
import { Search, X, AlertCircle } from "lucide-react";
import type { AttendanceFiltersValue } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface AttendanceFiltersProps {
  value: AttendanceFiltersValue;
  onChange: (value: AttendanceFiltersValue) => void;
  disabled?: boolean;
}

export const EMPTY_ATTENDANCE_FILTERS: AttendanceFiltersValue = {
  search: "",
  dateFrom: "",
  dateTo: "",
  department: "",
  status: "",
};

export const ATTENDANCE_DEPARTMENTS = [
  { value: "TECHNICAL", label: "القسم الفني" },
  { value: "CUSTOMER_SERVICE", label: "خدمة العملاء" },
  { value: "WAREHOUSE", label: "المخازن" },
  { value: "MANAGEMENT", label: "الإدارة" },
] as const;

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: "ON_TIME", label: "في الموعد" },
  { value: "LATE", label: "متأخر" },
] as const;

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AttendanceFilters({
  value,
  onChange,
  disabled = false,
}: AttendanceFiltersProps) {
  function update(field: keyof AttendanceFiltersValue, newValue: string) {
    onChange({
      ...value,
      [field]: newValue,
    });
  }

  const hasActiveFilters = Object.values(value).some(Boolean);

  const hasInvalidDateRange = Boolean(
    value.dateFrom && value.dateTo && value.dateFrom > value.dateTo
  );

  function clearFilters() {
    onChange({ ...EMPTY_ATTENDANCE_FILTERS });
  }

  return (
    <div className="space-y-4" dir="rtl" data-testid="attendance-filters">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {/* Search */}
        <div className="space-y-1">
          <label htmlFor="attendance-search" className="block text-xs font-medium text-muted-foreground">
            البحث عن موظف
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="attendance-search"
              type="search"
              value={value.search}
              onChange={(e) => update("search", e.target.value)}
              placeholder="اسم الموظف..."
              aria-label="البحث عن موظف"
              disabled={disabled}
              className="pr-9"
              data-testid="attendance-search-input"
            />
          </div>
        </div>

        {/* Date from */}
        <div className="space-y-1">
          <label
            htmlFor="attendance-date-from"
            className="block text-xs font-medium text-muted-foreground"
          >
            من تاريخ
          </label>
          <input
            id="attendance-date-from"
            type="date"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(e) => update("dateFrom", e.target.value)}
            disabled={disabled}
            className={fieldClass}
            data-testid="attendance-date-from"
          />
        </div>

        {/* Date to */}
        <div className="space-y-1">
          <label
            htmlFor="attendance-date-to"
            className="block text-xs font-medium text-muted-foreground"
          >
            إلى تاريخ
          </label>
          <input
            id="attendance-date-to"
            type="date"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(e) => update("dateTo", e.target.value)}
            disabled={disabled}
            className={fieldClass}
            data-testid="attendance-date-to"
          />
        </div>

        {/* Department */}
        <div className="space-y-1">
          <label
            htmlFor="attendance-department"
            className="block text-xs font-medium text-muted-foreground"
          >
            القسم
          </label>
          <select
            id="attendance-department"
            value={value.department}
            onChange={(e) => update("department", e.target.value)}
            disabled={disabled}
            className={fieldClass}
            data-testid="attendance-department-select"
          >
            <option value="">كل الأقسام</option>
            {ATTENDANCE_DEPARTMENTS.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label
            htmlFor="attendance-status"
            className="block text-xs font-medium text-muted-foreground"
          >
            حالة الحضور
          </label>
          <select
            id="attendance-status"
            value={value.status}
            onChange={(e) => update("status", e.target.value)}
            disabled={disabled}
            className={fieldClass}
            data-testid="attendance-status-select"
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
          data-testid="attendance-date-range-error"
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
            disabled={disabled}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            data-testid="attendance-clear-filters-btn"
          >
            <X className="h-3.5 w-3.5" />
            مسح الفلاتر
          </Button>
        </div>
      )}
    </div>
  );
}
