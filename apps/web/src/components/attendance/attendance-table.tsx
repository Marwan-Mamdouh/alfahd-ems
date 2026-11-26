"use client";

import React, { useMemo } from "react";
import { Edit2, ShieldAlert, ShieldX } from "lucide-react";
import type { AttendanceRow } from "./types";
import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { TablePagination } from "@/components/shared/data-table/pagination";
import { AttendanceStatusBadge } from "./attendance-status-badge";
import { Button } from "@/components/ui/button";

export interface AttendanceTableProps {
  records: AttendanceRow[];
  isLoading?: boolean;
  error?: Error | { message: string } | null;
  isForbidden?: boolean;
  forbiddenMessage?: string;
  onRetry?: () => void;
  onRecordClick?: (record: AttendanceRow) => void;
  onOverrideClick?: (record: AttendanceRow) => void;
  canOverride?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const dateStr = value.includes("T") ? value : `${value}T00:00:00`;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Cairo",
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatWorkingHours(
  hoursWorked?: number | null,
  workingMinutes?: number | null
): string {
  if (hoursWorked !== undefined && hoursWorked !== null && Number.isFinite(hoursWorked) && hoursWorked >= 0) {
    const hours = Math.floor(hoursWorked);
    const mins = Math.round((hoursWorked % 1) * 60);
    return `${hours} س ${mins} د`;
  }
  if (workingMinutes !== undefined && workingMinutes !== null && Number.isFinite(workingMinutes) && workingMinutes >= 0) {
    const hours = Math.floor(workingMinutes / 60);
    const mins = Math.floor(workingMinutes % 60);
    return `${hours} س ${mins} د`;
  }
  return "—";
}

export function AttendanceTable({
  records,
  isLoading = false,
  error,
  isForbidden = false,
  forbiddenMessage = "عذراً، ليس لديك الصلاحيات الكافية لعرض سجلات الحضور والانصراف.",
  onRetry,
  onRecordClick,
  onOverrideClick,
  canOverride = false,
  page,
  pageSize = 20,
  total,
  onPageChange,
}: AttendanceTableProps) {
  const columns = useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        key: "employeeName",
        header: "الموظف",
        render: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{row.employeeName}</p>
            <p className="text-xs text-muted-foreground">{row.department ?? "—"}</p>
          </div>
        ),
      },
      {
        key: "workDate",
        header: "التاريخ",
        render: (row) => formatDate(row.workDate || row.date),
      },
      {
        key: "checkInAt",
        header: "الحضور",
        render: (row) => formatTime(row.checkInAt || row.checkIn),
      },
      {
        key: "checkOutAt",
        header: "الانصراف",
        render: (row) => formatTime(row.checkOutAt || row.checkOut),
      },
      {
        key: "hoursWorked",
        header: "ساعات العمل",
        hideOnMobile: true,
        render: (row) => formatWorkingHours(row.hoursWorked, row.workingMinutes),
      },
      {
        key: "status",
        header: "الحالة",
        render: (row) => (
          <div className="space-y-1">
            <AttendanceStatusBadge status={row.status} />
            {row.overrideReason && (
              <div
                className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
                title={`معدل إدارياً: ${row.overrideReason}`}
                data-testid={`override-indicator-${row.id}`}
              >
                <ShieldAlert className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{row.overrideReason}</span>
              </div>
            )}
          </div>
        ),
      },
      ...(canOverride
        ? [
            {
              key: "actions",
              header: "الإجراءات",
              render: (row: AttendanceRow) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOverrideClick?.(row);
                  }}
                  className="gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                  data-testid={`override-row-btn-${row.id}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>تعديل</span>
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canOverride, onOverrideClick]
  );

  if (isForbidden) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20"
        dir="rtl"
        data-testid="attendance-forbidden-state"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
          <ShieldX className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-bold text-foreground">غير مصرح بالوصول</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{forbiddenMessage}</p>
      </div>
    );
  }

  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="space-y-4" dir="rtl" data-testid="attendance-table-container">
      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        error={error instanceof Error ? error : error ? new Error(error.message) : null}
        onRetry={onRetry}
        getRowKey={(record) => record.id}
        onRowClick={onRecordClick}
        emptyTitle="لا توجد سجلات حضور"
        emptyDescription="لا توجد سجلات حضور مطابقة للمحددات المطلوبة."
      />

      {total !== undefined && onPageChange && totalPages > 1 && (
        <TablePagination
          page={page ?? 1}
          totalPages={totalPages}
          total={total}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
