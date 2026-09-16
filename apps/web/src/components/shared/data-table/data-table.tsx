// src/components/shared/data-table/data-table.tsx
"use client";

import { cn } from "@/lib/utils";
import { ColumnDef } from "./types";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** مفتاح فريد لكل صف — id افتراضياً */
  getRowKey?: (row: T) => string;
  /** يظهر عند الـ click على الصف (اختياري) */
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  emptyTitle = "لا توجد بيانات",
  emptyDescription,
  getRowKey = (row) => (row as { id?: string }).id ?? JSON.stringify(row),
  onRowClick,
}: DataTableProps<T>) {
  // ── الحالات الثلاثة قبل رسم الجدول ──
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-right">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-medium text-muted-foreground whitespace-nowrap",
                    col.hideOnMobile && "hidden md:table-cell",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b transition-colors last:border-0 hover:bg-muted/30",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3",
                      col.hideOnMobile && "hidden md:table-cell",
                      col.className
                    )}
                  >
                    {/* لو في render مخصص استخدمه، وإلا اعرض القيمة الخام */}
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
