"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

export interface WarehouseStockRow {
  id: string;
  itemName: string;
  model: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
}

interface WarehouseStockTableProps {
  items: WarehouseStockRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

function StockStatus({ quantity, threshold }: { quantity: number; threshold: number }) {
  const isOutOfStock = quantity === 0;
  const isLowStock = quantity <= threshold;

  if (isOutOfStock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        نفد المخزون
      </span>
    );
  }

  if (isLowStock) {
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

export function WarehouseStockTable({
  items,
  isLoading = false,
  error,
  onRetry,
}: WarehouseStockTableProps) {
  const columns = useMemo<ColumnDef<WarehouseStockRow>[]>(
    () => [
      {
        key: "itemName",
        header: "الصنف",
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Package className="h-4 w-4" />
            </div>

            <div>
              <p className="font-semibold text-foreground">{row.itemName}</p>

              <p className="mt-1 text-xs text-muted-foreground">{row.model || "بدون موديل"}</p>
            </div>
          </div>
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
        header: "الكمية المتاحة",
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
      data={items}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(row) => row.id}
      emptyTitle="لا توجد أصناف في المخزن"
      emptyDescription="لم يتم تسجيل أي أصناف لهذا المخزن حتى الآن."
    />
  );
}
