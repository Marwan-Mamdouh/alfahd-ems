"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Package, Warehouse } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import type { InventoryStockRow } from "./types";

interface InventoryStockTableProps {
  stocks: InventoryStockRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onStockClick?: (stock: InventoryStockRow) => void;
}

function StockStatus({ quantity, threshold }: { quantity: number; threshold: number }) {
  if (quantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        نفد المخزون
      </span>
    );
  }

  if (quantity <= threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        مخزون منخفض
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      متوفر
    </span>
  );
}

export function InventoryStockTable({
  stocks,
  isLoading = false,
  error,
  onRetry,
  onStockClick,
}: InventoryStockTableProps) {
  const columns = useMemo<ColumnDef<InventoryStockRow>[]>(
    () => [
      {
        key: "itemName",
        header: "الصنف",
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Package className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-foreground">{row.itemName}</p>

              <p className="mt-1 text-xs text-muted-foreground">{row.model || "بدون موديل"}</p>
            </div>
          </div>
        ),
      },
      {
        key: "warehouseName",
        header: "المخزن",
        render: (row) => (
          <span className="inline-flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            {row.warehouseName}
          </span>
        ),
      },
      {
        key: "category",
        header: "التصنيف",
        hideOnMobile: true,
        render: (row) => row.category || "—",
      },
      {
        key: "quantity",
        header: "الكمية",
        render: (row) => (
          <span className="font-semibold">{row.quantity.toLocaleString("ar-EG")}</span>
        ),
      },
      {
        key: "lowStockThreshold",
        header: "حد التنبيه",
        hideOnMobile: true,
        render: (row) => row.lowStockThreshold.toLocaleString("ar-EG"),
      },
      {
        key: "status",
        header: "حالة المخزون",
        render: (row) => <StockStatus quantity={row.quantity} threshold={row.lowStockThreshold} />,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={stocks}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(row) => row.id}
      onRowClick={onStockClick}
      emptyTitle="لا توجد بيانات مخزون"
      emptyDescription="لم يتم تسجيل أي كميات للأصناف داخل المخازن حتى الآن."
    />
  );
}
