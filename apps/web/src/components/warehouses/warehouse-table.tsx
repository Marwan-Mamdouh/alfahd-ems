"use client";

import { useMemo } from "react";
import { Eye, MapPin, Package, Users } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { WarehouseRow } from "./types";

interface WarehouseTableProps {
  warehouses: WarehouseRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onWarehouseClick?: (warehouse: WarehouseRow) => void;
}

export function WarehouseTable({
  warehouses,
  isLoading = false,
  error,
  onRetry,
  onWarehouseClick,
}: WarehouseTableProps) {
  const columns = useMemo<ColumnDef<WarehouseRow>[]>(
    () => [
      {
        key: "name",
        header: "المخزن",
        render: (warehouse) => (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{warehouse.name}</p>

            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {warehouse.address}
            </p>
          </div>
        ),
      },
      {
        key: "staffCount",
        header: "الموظفون",
        render: (warehouse) => (
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {warehouse.staffCount.toLocaleString("ar-EG")}
          </span>
        ),
      },
      {
        key: "itemCount",
        header: "أصناف المخزون",
        hideOnMobile: true,
        render: (warehouse) => (
          <span className="inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            {warehouse.itemCount.toLocaleString("ar-EG")}
          </span>
        ),
      },
      {
        key: "location",
        header: "الموقع",
        hideOnMobile: true,
        render: (warehouse) => (
          <span dir="ltr" className="inline-block font-mono text-xs text-muted-foreground">
            {warehouse.latitude.toFixed(5)}, {warehouse.longitude.toFixed(5)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "التفاصيل",
        render: (warehouse) => (
          <button
            type="button"
            disabled={!onWarehouseClick}
            onClick={(event) => {
              event.stopPropagation();
              onWarehouseClick?.(warehouse);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
            aria-label={`عرض تفاصيل ${warehouse.name}`}
          >
            <Eye className="h-4 w-4" />
            عرض
          </button>
        ),
      },
    ],
    [onWarehouseClick]
  );

  return (
    <DataTable
      columns={columns}
      data={warehouses}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(warehouse) => warehouse.id}
      onRowClick={onWarehouseClick}
      emptyTitle="لا توجد مخازن"
      emptyDescription="لم تتم إضافة أي مخازن إلى النظام بعد."
    />
  );
}
