"use client";

import { useMemo } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  ArrowLeftRight,
  SlidersHorizontal,
  Activity,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { InventoryMovementRow } from "./types";

interface InventoryMovementsTableProps {
  movements: InventoryMovementRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

interface MovementStyle {
  label: string;
  icon: typeof ArrowDownToLine;
  className: string;
}

const MOVEMENT_CONFIG: Record<string, MovementStyle> = {
  INBOUND: {
    label: "وارد مورد",
    icon: ArrowDownToLine,
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  INBOUND_SUPPLIER: {
    label: "وارد مورد",
    icon: ArrowDownToLine,
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  OUTBOUND: {
    label: "صرف لفني",
    icon: ArrowUpFromLine,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  OUTBOUND_TECHNICIAN: {
    label: "صرف لفني",
    icon: ArrowUpFromLine,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  RETURN: {
    label: "مرتجع فني",
    icon: RotateCcw,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  RETURN_TECHNICIAN: {
    label: "مرتجع فني",
    icon: RotateCcw,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  TRANSFER_WAREHOUSE: {
    label: "تحويل مخزني",
    icon: ArrowLeftRight,
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  },
  ADJUSTMENT: {
    label: "تسوية جردية",
    icon: SlidersHorizontal,
    className:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
};

const DEFAULT_MOVEMENT_STYLE: MovementStyle = {
  label: "حركة مخزنية",
  icon: Activity,
  className:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

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

export function InventoryMovementsTable({
  movements,
  isLoading = false,
  error,
  onRetry,
}: InventoryMovementsTableProps) {
  const columns = useMemo<ColumnDef<InventoryMovementRow>[]>(
    () => [
      {
        key: "itemName",
        header: "الصنف",
        render: (row) => <span className="font-semibold text-foreground">{row.itemName}</span>,
      },
      {
        key: "type",
        header: "نوع الحركة",
        render: (row) => {
          const config = MOVEMENT_CONFIG[row.type] || DEFAULT_MOVEMENT_STYLE;
          const Icon = config.icon;

          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </span>
          );
        },
      },
      {
        key: "warehouseName",
        header: "المخزن",
      },
      {
        key: "quantity",
        header: "الكمية",
        render: (row) => (
          <span className="font-semibold">{row.quantity.toLocaleString("ar-EG")}</span>
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
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: "notes",
        header: "ملاحظات",
        hideOnMobile: true,
        render: (row) => (
          <span
            title={row.notes ?? undefined}
            className="block max-w-52 truncate text-muted-foreground"
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
      data={movements}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(row) => row.id}
      emptyTitle="لا توجد حركات مخزون"
      emptyDescription="لم يتم تسجيل أي عمليات وارد أو صادر أو تحويلات بعد."
    />
  );
}
