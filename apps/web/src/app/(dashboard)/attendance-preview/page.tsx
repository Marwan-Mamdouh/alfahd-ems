"use client";

import React, { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import type { AttendanceStatus, Department, JobStatusResponseDto, OverrideAttendanceDto } from "@alfahd/types";
import { RoleGuard } from "@/core/auth/guards";
import {
  AttendanceManagement,
  EMPTY_ATTENDANCE_FILTERS,
  type AttendanceFiltersValue,
  type AttendanceRow,
  type AttendanceLoadState,
  type Job,
  type ReportExportFormData,
} from "@/components/attendance";

// Authoritative DTO-shaped preview fixture records
const INITIAL_DEMO_RECORDS: AttendanceRow[] = [
  {
    id: "att-101",
    userId: "emp-1",
    employeeName: "أحمد محمد",
    department: "TECHNICAL" as Department,
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T08:00:00+03:00",
    checkOutAt: "2026-10-15T16:00:00+03:00",
    checkInDistanceM: 25,
    hoursWorked: 8.0,
    status: "ON_TIME" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
  {
    id: "att-102",
    userId: "emp-2",
    employeeName: "محمد علي",
    department: "WAREHOUSE" as Department,
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T08:35:00+03:00",
    checkOutAt: "2026-10-15T16:15:00+03:00",
    checkInDistanceM: 10,
    hoursWorked: 7.6,
    status: "LATE" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
  {
    id: "att-103",
    userId: "emp-3",
    employeeName: "سارة أحمد",
    department: "CUSTOMER_SERVICE" as Department,
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T08:05:00+03:00",
    checkOutAt: "2026-10-15T16:05:00+03:00",
    checkInDistanceM: 45,
    hoursWorked: 8.0,
    status: "ON_TIME" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
  {
    id: "att-104",
    userId: "emp-4",
    employeeName: "محمود خالد",
    department: "MANAGEMENT" as Department,
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T07:55:00+03:00",
    checkOutAt: "2026-10-15T16:05:00+03:00",
    checkInDistanceM: 12,
    hoursWorked: 8.1,
    status: "ON_TIME" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
  {
    id: "att-105",
    userId: "emp-1",
    employeeName: "أحمد محمد",
    department: "TECHNICAL" as Department,
    workDate: "2026-10-14",
    checkInAt: "2026-10-14T08:20:00+03:00",
    checkOutAt: "2026-10-14T16:00:00+03:00",
    checkInDistanceM: 30,
    hoursWorked: 7.6,
    status: "LATE" as AttendanceStatus,
    overrideReason: "إذن رسمي من مدير القسم",
    overriddenBy: "Admin",
    overriddenAt: "2026-10-14T17:00:00Z",
  },
  {
    id: "att-106",
    userId: "emp-2",
    employeeName: "محمد علي",
    department: "WAREHOUSE" as Department,
    workDate: "2026-10-14",
    checkInAt: "2026-10-14T08:00:00+03:00",
    checkOutAt: "2026-10-14T16:00:00+03:00",
    checkInDistanceM: 15,
    hoursWorked: 8.0,
    status: "ON_TIME" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
  {
    id: "att-107",
    userId: "emp-3",
    employeeName: "سارة أحمد",
    department: "CUSTOMER_SERVICE" as Department,
    workDate: "2026-10-14",
    checkInAt: "2026-10-14T08:05:00+03:00",
    checkOutAt: "2026-10-14T16:05:00+03:00",
    checkInDistanceM: 20,
    hoursWorked: 8.0,
    status: "ON_TIME" as AttendanceStatus,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  },
];

function AttendancePreviewContent() {
  const [records, setRecords] = useState<AttendanceRow[]>(INITIAL_DEMO_RECORDS);
  const [filters, setFilters] = useState<AttendanceFiltersValue>({
    ...EMPTY_ATTENDANCE_FILTERS,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Visual simulation states for QA and developer review
  const [stateMode, setStateMode] = useState<"ready" | "loading" | "error" | "forbidden">("ready");
  const [job, setJob] = useState<Job>({ kind: "idle" });

  // Filtered matching records
  const allMatchingRecords = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return records
      .filter((rec) => {
        const matchesSearch = !search || rec.employeeName.toLowerCase().includes(search);
        const matchesDateFrom = !filters.dateFrom || (rec.workDate && rec.workDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (rec.workDate && rec.workDate <= filters.dateTo);
        const matchesDept = !filters.department || rec.department === filters.department;
        const matchesStatus = !filters.status || rec.status === filters.status;
        return matchesSearch && matchesDateFrom && matchesDateTo && matchesDept && matchesStatus;
      })
      .sort((a, b) => (b.workDate || "").localeCompare(a.workDate || "") || a.employeeName.localeCompare(b.employeeName));
  }, [records, filters]);

  // Server totals across ALL matching records (not current page only)
  const serverTotals = useMemo(
    () => ({
      total: allMatchingRecords.length,
      onTime: allMatchingRecords.filter((r) => r.status === "ON_TIME").length,
      late: allMatchingRecords.filter((r) => r.status === "LATE").length,
    }),
    [allMatchingRecords]
  );

  // Paginated slice for current page
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allMatchingRecords.slice(start, start + pageSize);
  }, [allMatchingRecords, currentPage, pageSize]);

  // Construct AttendanceLoadState
  const loadState: AttendanceLoadState = useMemo(() => {
    if (stateMode === "loading") {
      return { kind: "loading" };
    }
    if (stateMode === "error") {
      return {
        kind: "error",
        message: "فشل تحميل سجلات الحضور من الخادم. يرجى التحقق من الاتصال بالشبكة.",
        retry: () => setStateMode("ready"),
      };
    }
    if (stateMode === "forbidden") {
      return {
        kind: "forbidden",
        message: "ليس لديك صلاحية الوصول إلى سجلات الحضور والانصراف (يتطلب صلاحية ADMIN).",
      };
    }
    return {
      kind: "ready",
      value: {
        page: {
          items: paginatedItems,
          total: allMatchingRecords.length,
          page: currentPage,
          pageSize,
        },
        totals: serverTotals,
      },
    };
  }, [stateMode, paginatedItems, allMatchingRecords.length, currentPage, pageSize, serverTotals]);

  // Handle Admin Override mutation
  const handleOverride = async (id: string, value: OverrideAttendanceDto) => {
    // Simulate mutation latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;
        return {
          ...rec,
          status: value.status ?? rec.status,
          checkInAt: value.checkInAt ?? rec.checkInAt,
          checkOutAt: value.checkOutAt ?? rec.checkOutAt,
          overrideReason: value.overrideReason,
          overriddenBy: "مسؤول النظام (Admin)",
          overriddenAt: new Date().toISOString(),
        };
      })
    );
  };

  // Handle Async Report Export Job simulation
  const handleExportRequest = async (_params: ReportExportFormData) => {
    setJob({ kind: "submitting" });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const mockJob: JobStatusResponseDto = {
      id: `job-${Date.now()}`,
      status: "QUEUED",
      downloadUrl: null,
    };
    setJob({ kind: "polling", job: mockJob });

    // Transition to RUNNING
    setTimeout(() => {
      setJob({
        kind: "polling",
        job: { ...mockJob, status: "RUNNING" },
      });
    }, 1200);

    // Transition to COMPLETE
    setTimeout(() => {
      setJob({
        kind: "complete",
        job: {
          ...mockJob,
          status: "COMPLETED",
          downloadUrl: "https://example.com/reports/attendance-export.xlsx",
        },
      });
    }, 2500);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Compliance & Preview Warning */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">وضع المعاينة المعتمد — Phase 2 Frontend Review</p>
            <p className="mt-0.5 text-xs">
              مكونات الواجهة تعمل بنماذج البيانات المعتمدة لعقود المرحلة الثانية (المشكلة #83).
            </p>
          </div>
        </div>

        {/* State Toggle Buttons for Review */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-muted-foreground ml-1">محاكاة الحالة:</span>
          {(["ready", "loading", "error", "forbidden"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setStateMode(mode)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                stateMode === mode
                  ? "bg-amber-600 text-white"
                  : "bg-white/80 hover:bg-white text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Presentational Component */}
      <AttendanceManagement
        data={loadState}
        filter={filters}
        capabilities={{
          view: true,
          override: true,
          export: true,
        }}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        onPageChange={setCurrentPage}
        job={job}
        onOverride={handleOverride}
        onExportRequest={handleExportRequest}
      />
    </div>
  );
}

export default function AttendancePreviewPage() {
  return (
    <RoleGuard permission="attendance.view">
      <AttendancePreviewContent />
    </RoleGuard>
  );
}
