"use client";

import { useMemo } from "react";
import { Eye, MapPin, Pencil, PowerOff, ShieldAlert, User, ChevronLeft, ChevronRight } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";

import type { WarehouseRow, WarehouseCapabilities } from "./types";

export interface WarehouseTableProps {
  warehouses: WarehouseRow[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  onWarehouseClick?: (warehouse: WarehouseRow) => void;
  onEditClick?: (warehouse: WarehouseRow) => void;
  onDeactivateClick?: (warehouse: WarehouseRow) => void;
  canManage?: boolean;
  capabilities?: WarehouseCapabilities;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function WarehouseTable({
  warehouses,
  isLoading = false,
  error = null,
  onRetry,
  onWarehouseClick,
  onEditClick,
  onDeactivateClick,
  canManage = false,
  capabilities,
  page,
  pageSize = 10,
  total,
  onPageChange,
}: WarehouseTableProps) {
  const canEdit = capabilities?.edit ?? canManage;
  const canDeactivate = capabilities?.deactivate ?? canManage;

  const resolvedError = typeof error === "string" ? new Error(error) : error;

  const columns = useMemo<ColumnDef<WarehouseRow>[]>(
    () => [
      {
        key: "name",
        header: "المخزن والمقر",
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
        key: "manager",
        header: "مدير المخزن",
        render: (warehouse) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">
              {warehouse.managerName
                ? warehouse.managerName
                : warehouse.managerId
                ? "مدير مسجل"
                : "بدون مدير معين"}
            </span>
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
              <Eye className="h-3.5 w-3.5" />
              عرض
            </button>

            {canEdit && onEditClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditClick(warehouse);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={`تعديل بيانات ${warehouse.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </button>
            )}

            {canDeactivate && warehouse.isActive && onDeactivateClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeactivateClick(warehouse);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                aria-label={`تعطيل ${warehouse.name}`}
              >
                <PowerOff className="h-3.5 w-3.5" />
                تعطيل
              </button>
            )}
          </div>
        ),
      },
    ],
    [onWarehouseClick, onEditClick, onDeactivateClick, canEdit, canDeactivate]
  );

  const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={warehouses}
        isLoading={isLoading}
        error={resolvedError}
        onRetry={onRetry}
        getRowKey={(warehouse) => warehouse.id}
        onRowClick={onWarehouseClick}
        emptyTitle="لا توجد مخازن"
        emptyDescription="لم تتم إضافة أي مخازن إلى النظام بعد."
      />

      {/* Pagination controls when provided */}
      {typeof page === "number" && total !== undefined && onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <p>
            صفحة {page} من {totalPages} (إجمالي {total} مخزن)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
