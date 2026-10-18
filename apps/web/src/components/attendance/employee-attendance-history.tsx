"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";

import { AttendanceTable, type AttendanceRow } from "./attendance-table";

interface EmployeeAttendanceHistoryProps {
  employeeId: string;
  records: AttendanceRow[];
  onBack: () => void;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function EmployeeAttendanceHistory({
  employeeId,
  records,
  onBack,
  isLoading = false,
  error,
  onRetry,
}: EmployeeAttendanceHistoryProps) {
  const employeeRecords = useMemo(
    () =>
      records
        .filter((record) => record.employeeId === employeeId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [records, employeeId]
  );

  const employeeName = employeeRecords[0]?.employeeName ?? "الموظف";

  const stats = useMemo(
    () => ({
      total: employeeRecords.length,
      onTime: employeeRecords.filter((record) => record.status === "ON_TIME").length,
      late: employeeRecords.filter((record) => record.status === "LATE").length,
      absent: employeeRecords.filter((record) => record.status === "ABSENT").length,
    }),
    [employeeRecords]
  );

  return (
    <section className="space-y-6" dir="rtl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
      >
        <ArrowRight className="h-4 w-4" />
        العودة لسجلات الحضور
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <CalendarDays className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold">سجل حضور {employeeName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              عرض جميع سجلات الحضور والانصراف المتاحة للموظف
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "إجمالي السجلات", value: stats.total },
            { label: "في الموعد", value: stats.onTime },
            { label: "متأخر", value: stats.late },
            { label: "غائب", value: stats.absent },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold">{stat.value.toLocaleString("ar-EG")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">السجل التاريخي</h3>

        <AttendanceTable
          records={employeeRecords}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
        />
      </div>
    </section>
  );
}
