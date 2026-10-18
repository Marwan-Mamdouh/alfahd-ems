"use client";

import { useMemo } from "react";
import { ArrowLeftRight, CalendarClock, History } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { RouterHistoryRow, RouterStatus } from "./types";

interface RouterHistoryTableProps {
  history: RouterHistoryRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<
  RouterStatus,
  {
    label: string;
    className: string;
  }
> = {
  IN_STOCK: {
    label: "بالمخزن",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  ASSIGNED: {
    label: "مخصص لفني",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  INSTALLED: {
    label: "تم التركيب",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  },
  RETURNED: {
    label: "مرتجع",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  DAMAGED: {
    label: "تالف",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
};

function StatusBadge({ status }: { status: RouterStatus | null }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function formatDateTime(value: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  }).format(date);
}

export function RouterHistoryTable({
  history,
  isLoading = false,
  error,
  onRetry,
}: RouterHistoryTableProps) {
  const columns = useMemo<ColumnDef<RouterHistoryRow>[]>(
    () => [
      {
        key: "action",
        header: "العملية",
        render: (row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <History className="h-4 w-4" />
            </div>

            <span className="font-semibold">{row.action}</span>
          </div>
        ),
      },
      {
        key: "statusChange",
        header: "تغيير الحالة",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={row.previousStatus} />

            <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />

            <StatusBadge status={row.newStatus} />
          </div>
        ),
      },
      {
        key: "performedBy",
        header: "المسؤول",
        hideOnMobile: true,
        render: (row) => row.performedBy || "—",
      },
      {
        key: "createdAt",
        header: "التاريخ والوقت",
        render: (row) => (
          <span className="inline-flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            {formatDateTime(row.createdAt)}
          </span>
        ),
      },
      {
        key: "notes",
        header: "ملاحظات",
        hideOnMobile: true,
        render: (row) => (
          <span
            title={row.notes ?? undefined}
            className="block max-w-56 truncate text-sm text-muted-foreground"
          >
            {row.notes || "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={history}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(row) => row.id}
      emptyTitle="لا يوجد سجل للراوتر"
      emptyDescription="لم يتم تسجيل أي عمليات على هذا الراوتر حتى الآن."
    />
  );
}
