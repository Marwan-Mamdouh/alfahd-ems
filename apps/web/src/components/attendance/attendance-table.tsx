"use client";

import { useMemo } from "react";
import type { AttendanceStatus } from "@alfahd/types";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { AttendanceStatusBadge } from "./attendance-status-badge";

// Frontend display model.
// Will be mapped to the actual backend DTO during integration.
export interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;

  // Date format: YYYY-MM-DD
  date: string;

  // ISO date-time values, or null if unavailable.
  checkIn: string | null;
  checkOut: string | null;

  // Calculated working time, in minutes.
  workingMinutes: number | null;

  status: AttendanceStatus;
}

interface AttendanceTableProps {
  records: AttendanceRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRecordClick?: (record: AttendanceRow) => void;
}

function formatDate(value: string): string {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  }).format(date);
}

function formatWorkingHours(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) {
    return "—";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);

  return `${hours} س ${remainingMinutes} د`;
}

export function AttendanceTable({
  records,
  isLoading = false,
  error,
  onRetry,
  onRecordClick,
}: AttendanceTableProps) {
  const columns = useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        key: "employeeName",
        header: "الموظف",
        render: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{row.employeeName}</p>

            <p className="text-xs text-muted-foreground">{row.department}</p>
          </div>
        ),
      },
      {
        key: "date",
        header: "التاريخ",
        render: (row) => formatDate(row.date),
      },
      {
        key: "checkIn",
        header: "الحضور",
        render: (row) => formatTime(row.checkIn),
      },
      {
        key: "checkOut",
        header: "الانصراف",
        render: (row) => formatTime(row.checkOut),
      },
      {
        key: "workingMinutes",
        header: "ساعات العمل",
        hideOnMobile: true,
        render: (row) => formatWorkingHours(row.workingMinutes),
      },
      {
        key: "status",
        header: "الحالة",
        render: (row) => <AttendanceStatusBadge status={row.status} />,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(record) => record.id}
      onRowClick={onRecordClick}
      emptyTitle="لا توجد سجلات حضور"
      emptyDescription="لا توجد سجلات حضور مطابقة للبيانات المطلوبة."
    />
  );
}
