"use client";

import { useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { InventoryMovementRow, InventoryMovementType } from "./types";

interface InventoryMovementsTableProps {
  movements: InventoryMovementRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const MOVEMENT_CONFIG = {
  INBOUND: {
    label: "وارد",
    icon: ArrowDownToLine,
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  OUTBOUND: {
    label: "صادر",
    icon: ArrowUpFromLine,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  RETURN: {
    label: "مرتجع",
    icon: RotateCcw,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
} satisfies Record<
  InventoryMovementType,
  {
    label: string;
    icon: typeof ArrowDownToLine;
    className: string;
  }
>;

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
          const config = MOVEMENT_CONFIG[row.type];
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
      emptyDescription="لم يتم تسجيل أي عمليات وارد أو صادر أو مرتجعات بعد."
    />
  );
}