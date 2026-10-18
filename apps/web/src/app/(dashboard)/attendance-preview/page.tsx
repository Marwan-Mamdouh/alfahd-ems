"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Users, Clock3, UserX, CheckCircle2, FlaskConical } from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";

import { AttendanceTable, type AttendanceRow } from "@/components/attendance/attendance-table";

import {
  AttendanceFilters,
  EMPTY_ATTENDANCE_FILTERS,
  type AttendanceFiltersValue,
} from "@/components/attendance/attendance-filters";

import { EmployeeAttendanceHistory } from "@/components/attendance/employee-attendance-history";

// Preview data only. No backend requests.
const DEMO_ATTENDANCE: AttendanceRow[] = [
  {
    id: "attendance-1",
    employeeId: "emp-1",
    employeeName: "أحمد محمد",
    department: "TECHNICAL",
    date: "2026-10-15",
    checkIn: "2026-10-15T08:00:00+03:00",
    checkOut: "2026-10-15T16:00:00+03:00",
    workingMinutes: 480,
    status: "ON_TIME",
  },
  {
    id: "attendance-2",
    employeeId: "emp-2",
    employeeName: "محمد علي",
    department: "WAREHOUSE",
    date: "2026-10-15",
    checkIn: "2026-10-15T08:35:00+03:00",
    checkOut: "2026-10-15T16:15:00+03:00",
    workingMinutes: 460,
    status: "LATE",
  },
  {
    id: "attendance-3",
    employeeId: "emp-3",
    employeeName: "سارة أحمد",
    department: "CUSTOMER_SERVICE",
    date: "2026-10-15",
    checkIn: null,
    checkOut: null,
    workingMinutes: null,
    status: "ABSENT",
  },
  {
    id: "attendance-4",
    employeeId: "emp-4",
    employeeName: "محمود خالد",
    department: "MANAGEMENT",
    date: "2026-10-15",
    checkIn: "2026-10-15T07:55:00+03:00",
    checkOut: "2026-10-15T16:05:00+03:00",
    workingMinutes: 490,
    status: "ON_TIME",
  },
  {
    id: "attendance-5",
    employeeId: "emp-1",
    employeeName: "أحمد محمد",
    department: "TECHNICAL",
    date: "2026-10-14",
    checkIn: "2026-10-14T08:20:00+03:00",
    checkOut: "2026-10-14T16:00:00+03:00",
    workingMinutes: 460,
    status: "LATE",
  },
  {
    id: "attendance-6",
    employeeId: "emp-2",
    employeeName: "محمد علي",
    department: "WAREHOUSE",
    date: "2026-10-14",
    checkIn: "2026-10-14T08:00:00+03:00",
    checkOut: "2026-10-14T16:00:00+03:00",
    workingMinutes: 480,
    status: "ON_TIME",
  },
  {
    id: "attendance-7",
    employeeId: "emp-3",
    employeeName: "سارة أحمد",
    department: "CUSTOMER_SERVICE",
    date: "2026-10-14",
    checkIn: "2026-10-14T08:05:00+03:00",
    checkOut: "2026-10-14T16:05:00+03:00",
    workingMinutes: 480,
    status: "ON_TIME",
  },
  {
    id: "attendance-8",
    employeeId: "emp-4",
    employeeName: "محمود خالد",
    department: "MANAGEMENT",
    date: "2026-10-14",
    checkIn: null,
    checkOut: null,
    workingMinutes: null,
    status: "ABSENT",
  },
];

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  className: string;
}

function StatCard({ title, value, icon, className }: StatCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>

        <p className="text-3xl font-bold text-foreground">{value.toLocaleString("ar-EG")}</p>
      </div>

      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${className}`}
      >
        {icon}
      </div>
    </div>
  );
}

function AttendancePreviewContent() {
  const [filters, setFilters] = useState<AttendanceFiltersValue>({
    ...EMPTY_ATTENDANCE_FILTERS,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const invalidDateRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
  );

  const filteredRecords = useMemo(() => {
    if (invalidDateRange) return [];

    const search = filters.search.trim().toLowerCase();

    return DEMO_ATTENDANCE.filter((record) => {
      const matchesSearch = !search || record.employeeName.toLowerCase().includes(search);

      const matchesDateFrom = !filters.dateFrom || record.date >= filters.dateFrom;

      const matchesDateTo = !filters.dateTo || record.date <= filters.dateTo;

      const matchesDepartment = !filters.department || record.department === filters.department;

      const matchesStatus = !filters.status || record.status === filters.status;

      return (
        matchesSearch && matchesDateFrom && matchesDateTo && matchesDepartment && matchesStatus
      );
    }).sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
  }, [filters, invalidDateRange]);

  const stats = useMemo(
    () => ({
      total: filteredRecords.length,
      onTime: filteredRecords.filter((record) => record.status === "ON_TIME").length,
      late: filteredRecords.filter((record) => record.status === "LATE").length,
      absent: filteredRecords.filter((record) => record.status === "ABSENT").length,
    }),
    [filteredRecords]
  );

  function openEmployeeHistory(record: AttendanceRow) {
    setSelectedEmployeeId(record.employeeId);
  }

  function backToAttendanceList() {
    setSelectedEmployeeId(null);
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Preview Warning */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">وضع المعاينة — بيانات تجريبية</p>

          <p className="mt-1 text-sm">
            جميع سجلات الحضور المعروضة تجريبية. الصفحة غير متصلة بقاعدة البيانات، والإحصائيات تعتمد
            على بيانات المعاينة.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <CalendarCheck className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة الحضور والانصراف</h1>

              <p className="mt-1 text-sm text-white/80">Attendance Management — Phase 2</p>
            </div>
          </div>

          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">سجل تجريبي</div>
        </div>

        <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-white/5" />
      </div>

      {selectedEmployeeId ? (
        <EmployeeAttendanceHistory
          employeeId={selectedEmployeeId}
          records={DEMO_ATTENDANCE}
          onBack={backToAttendanceList}
        />
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="إجمالي السجلات"
              value={stats.total}
              icon={<Users className="h-6 w-6" />}
              className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />

            <StatCard
              title="في الموعد"
              value={stats.onTime}
              icon={<CheckCircle2 className="h-6 w-6" />}
              className="bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            />

            <StatCard
              title="المتأخرون"
              value={stats.late}
              icon={<Clock3 className="h-6 w-6" />}
              className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            />

            <StatCard
              title="الغياب"
              value={stats.absent}
              icon={<UserX className="h-6 w-6" />}
              className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            />
          </div>

          {/* Records */}
          <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-foreground">سجلات الحضور والانصراف</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                ابحث في السجلات، واضغط على أي صف لعرض السجل التاريخي للموظف.
              </p>
            </div>

            <AttendanceFilters value={filters} onChange={setFilters} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                عدد السجلات المطابقة: {filteredRecords.length}
              </p>

              <p className="text-xs text-muted-foreground">اضغط على السجل لعرض تاريخ الموظف</p>
            </div>

            <AttendanceTable records={filteredRecords} onRecordClick={openEmployeeHistory} />
          </section>
        </>
      )}
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
