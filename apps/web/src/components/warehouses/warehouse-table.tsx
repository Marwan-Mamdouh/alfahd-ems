"use client";

import { useMemo } from "react";
import { Eye, MapPin, ShieldAlert, Trash2 } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { WarehouseRow } from "./types";

interface WarehouseTableProps {
  warehouses: WarehouseRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onWarehouseClick?: (warehouse: WarehouseRow) => void;
  onDeactivateClick?: (warehouse: WarehouseRow) => void;
  canManage?: boolean;
}

export function WarehouseTable({
  warehouses,
  isLoading = false,
  error,
  onRetry,
  onWarehouseClick,
  onDeactivateClick,
  canManage = false,
}: WarehouseTableProps) {
  const columns = useMemo<ColumnDef<WarehouseRow>[]>(
    () => [
      {
        key: "name",
        header: "المخزن",
        render: (warehouse) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">{warehouse.name}</p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  warehouse.isActive
                    ? "border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
                    : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                {warehouse.isActive ? "نشط" : "معطل"}
              </span>
            </div>

            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {warehouse.address}
            </p>
          </div>
        ),
      },
      {
        key: "geofence",
        header: "السياج الجغرافي",
        render: (warehouse) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-teal-600" />
            {warehouse.geofenceRadiusMeters ?? 150} متر
          </span>
        ),
      },
      {
        key: "location",
        header: "الإحداثيات",
        hideOnMobile: true,
        render: (warehouse) => (
          <span dir="ltr" className="inline-block font-mono text-xs text-muted-foreground">
            {warehouse.latitude.toFixed(4)}, {warehouse.longitude.toFixed(4)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "الإجراءات",
        render: (warehouse) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!onWarehouseClick}
              onClick={(event) => {
                event.stopPropagation();
                onWarehouseClick?.(warehouse);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
              aria-label={`عرض تفاصيل ${warehouse.name}`}
            >
              <Eye className="h-4 w-4" />
              عرض
            </button>

            {canManage && warehouse.isActive && onDeactivateClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeactivateClick(warehouse);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                aria-label={`تعطيل ${warehouse.name}`}
              >
                <Trash2 className="h-4 w-4" />
                تعطيل
              </button>
            )}
          </div>
        ),
      },
    ],
    [onWarehouseClick, onDeactivateClick, canManage]
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
