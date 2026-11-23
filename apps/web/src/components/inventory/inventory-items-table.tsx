"use client";

import { useMemo } from "react";
import { Package, Eye, Pencil, Archive, ChevronLeft, ChevronRight } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import type { InventoryItemRow, ProductCapabilities } from "./types";

export interface InventoryItemsTableProps {
  items: InventoryItemRow[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  onItemClick?: (item: InventoryItemRow) => void;
  onEdit?: (item: InventoryItemRow) => void;
  onDeactivate?: (item: InventoryItemRow) => void;
  canEdit?: boolean;
  canDeactivate?: boolean;
  capabilities?: ProductCapabilities;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function InventoryItemsTable({
  items,
  isLoading = false,
  error = null,
  onRetry,
  onItemClick,
  onEdit,
  onDeactivate,
  canEdit: directCanEdit = false,
  canDeactivate: directCanDeactivate = false,
  capabilities,
  page,
  pageSize = 10,
  total,
  onPageChange,
}: InventoryItemsTableProps) {
  const canEdit = capabilities?.edit ?? directCanEdit;
  const canDeactivate = capabilities?.deactivate ?? directCanDeactivate;

  const resolvedError = typeof error === "string" ? new Error(error) : error;

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
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{item.name}</p>
                {item.isSerialized && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    سيريال
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.sku ? `${item.sku} • ${item.model}` : item.model || "بدون موديل"}
              </p>
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
        key: "status",
        header: "الحالة",
        render: (item) =>
          item.isActive !== false ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              نشط
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              معطّل / مؤرشف
            </span>
          ),
      },
      {
        key: "stock",
        header: "المخزون والحد الأدنى",
        hideOnMobile: true,
        render: (item) => (
          <div className="text-xs space-y-0.5">
            {typeof item.totalStock === "number" && (
              <p className="font-semibold text-foreground">
                الإجمالي: {item.totalStock.toLocaleString("ar-EG")}
              </p>
            )}
            <p className="text-muted-foreground">
              حد التنبيه: {(item.lowStockThreshold ?? 10).toLocaleString("ar-EG")}
            </p>
          </div>
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
        header: "الإجراءات",
        render: (item) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!onItemClick}
              onClick={(event) => {
                event.stopPropagation();
                onItemClick?.(item);
              }}
              aria-label={`عرض تفاصيل ${item.name}`}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
            >
              <Eye className="h-3.5 w-3.5" />
              عرض
            </button>

            {canEdit && onEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(item);
                }}
                aria-label={`تعديل صنف ${item.name}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </button>
            )}

            {canDeactivate && item.isActive !== false && onDeactivate && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeactivate(item);
                }}
                aria-label={`تعطيل صنف ${item.name}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <Archive className="h-3.5 w-3.5" />
                تعطيل
              </button>
            )}
          </div>
        ),
      },
    ],
    [onItemClick, onEdit, onDeactivate, canEdit, canDeactivate]
  );

  const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        error={resolvedError}
        onRetry={onRetry}
        getRowKey={(item) => item.id}
        onRowClick={onItemClick}
        emptyTitle="لا توجد أصناف في الكتالوج"
        emptyDescription="لم يتم تسجيل أي أصناف في النظام بعد."
      />

      {typeof page === "number" && total !== undefined && onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <p>
            صفحة {page} من {totalPages} (إجمالي {total} صنف)
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
