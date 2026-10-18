"use client";

import { useMemo } from "react";
import { Package, Eye } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import type { InventoryItemRow } from "./types";

interface InventoryItemsTableProps {
  items: InventoryItemRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onItemClick?: (item: InventoryItemRow) => void;
}

export function InventoryItemsTable({
  items,
  isLoading = false,
  error,
  onRetry,
  onItemClick,
}: InventoryItemsTableProps) {
  const columns = useMemo<ColumnDef<InventoryItemRow>[]>(
    () => [
      {
        key: "name",
        header: "الصنف",
        render: (item) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Package className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-foreground">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.model || "بدون موديل"}</p>
            </div>
          </div>
        ),
      },
      {
        key: "category",
        header: "التصنيف",
        render: (item) => (
          <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
            {item.category || "غير مصنف"}
          </span>
        ),
      },
      {
        key: "description",
        header: "الوصف",
        hideOnMobile: true,
        render: (item) => (
          <p
            className="max-w-xs truncate text-sm text-muted-foreground"
            title={item.description || undefined}
          >
            {item.description || "—"}
          </p>
        ),
      },
      {
        key: "actions",
        header: "التفاصيل",
        render: (item) => (
          <button
            type="button"
            disabled={!onItemClick}
            onClick={(event) => {
              event.stopPropagation();
              onItemClick?.(item);
            }}
            aria-label={`عرض تفاصيل ${item.name}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
          >
            <Eye className="h-4 w-4" />
            عرض
          </button>
        ),
      },
    ],
    [onItemClick]
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(item) => item.id}
      onRowClick={onItemClick}
      emptyTitle="لا توجد أصناف"
      emptyDescription="لم يتم تسجيل أي أصناف في كتالوج المخزون حتى الآن."
    />
  );
}
