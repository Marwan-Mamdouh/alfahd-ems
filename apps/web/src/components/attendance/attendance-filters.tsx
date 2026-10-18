"use client";

import { Search, X, CalendarDays } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface AttendanceFiltersValue {
  search: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  status: string;
}

interface AttendanceFiltersProps {
  value: AttendanceFiltersValue;
  onChange: (value: AttendanceFiltersValue) => void;
}

export const EMPTY_ATTENDANCE_FILTERS: AttendanceFiltersValue = {
  search: "",
  dateFrom: "",
  dateTo: "",
  department: "",
  status: "",
};

// Temporary department values until confirmed
// with the backend and client.
const DEPARTMENTS = [
  { value: "WAREHOUSE", label: "المخازن" },
  { value: "TECHNICAL", label: "القسم الفني" },
  { value: "CUSTOMER_SERVICE", label: "خدمة العملاء" },
  { value: "MANAGEMENT", label: "الإدارة" },
];

const STATUSES = [
  { value: "ON_TIME", label: "في الموعد" },
  { value: "LATE", label: "متأخر" },
  { value: "ABSENT", label: "غائب" },
];

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AttendanceFilters({ value, onChange }: AttendanceFiltersProps) {
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
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />

          <Input
            type="search"
            value={value.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="بحث باسم الموظف..."
            aria-label="البحث عن موظف"
            className="pr-9"
          />
        </div>

        {/* Date from */}
        <div className="relative">
          <label
            htmlFor="attendance-date-from"
            className="mb-1 block text-xs text-muted-foreground"
          >
            من تاريخ
          </label>

          <input
            id="attendance-date-from"
            type="date"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(event) => update("dateFrom", event.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Date to */}
        <div>
          <label htmlFor="attendance-date-to" className="mb-1 block text-xs text-muted-foreground">
            إلى تاريخ
          </label>

          <input
            id="attendance-date-to"
            type="date"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(event) => update("dateTo", event.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Department */}
        <div>
          <label
            htmlFor="attendance-department"
            className="mb-1 block text-xs text-muted-foreground"
          >
            القسم
          </label>

          <select
            id="attendance-department"
            value={value.department}
            onChange={(event) => update("department", event.target.value)}
            className={fieldClass}
          >
            <option value="">كل الأقسام</option>

            {DEPARTMENTS.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="attendance-status" className="mb-1 block text-xs text-muted-foreground">
            حالة الحضور
          </label>

          <select
            id="attendance-status"
            value={value.status}
            onChange={(event) => update("status", event.target.value)}
            className={fieldClass}
          >
            <option value="">كل الحالات</option>

            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasInvalidDateRange && (
        <p role="alert" className="text-sm text-red-600">
          تاريخ البداية يجب أن يكون قبل تاريخ النهاية.
        </p>
      )}

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            مسح الفلاتر
          </Button>
        </div>
      )}
    </div>
  );
}
