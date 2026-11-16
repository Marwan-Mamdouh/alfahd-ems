"use client";

import {
  Archive,
  ArchiveRestore,
  History,
  Lock,
  Network,
  Pencil,
  RotateCcw,
  Search,
  Unlock,
} from "lucide-react";

import { TablePagination } from "@/components/shared/data-table/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { IpArchivedBadge, IpStatusBadge } from "./ip-status-badge";
import type { IpStatus, IpTableProps } from "./types";

function formatDate(dateString: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Presentational table and filter controls for IPv4 Pool Management.
 * Follows the F6 specification (#87) and does not perform network calls.
 */
export function IpTable({
  data,
  filter,
  capabilities,
  onFilterChange,
  onPageChange,
  onSelectAction,
  onSelectEdit,
  onViewHistory,
}: IpTableProps) {
  const hasActiveFilters = Boolean(
    filter.search || filter.status || filter.isArchived !== undefined
  );

  const hasAnyActionCapability = Boolean(
    capabilities.edit ||
      capabilities.reserve ||
      capabilities.archive ||
      capabilities.history
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filter,
      search: e.target.value.trim() ? e.target.value : undefined,
      page: 1,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange({
      ...filter,
      status: val ? (val as IpStatus) : undefined,
      page: 1,
    });
  };

  const handleArchivedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    let isArchived: boolean | undefined;
    if (val === "true") isArchived = true;
    else if (val === "false") isArchived = false;

    onFilterChange({
      ...filter,
      isArchived,
      page: 1,
    });
  };

  const handleResetFilters = () => {
    onFilterChange({
      page: 1,
      limit: filter.limit,
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="البحث بالعنوان أو الملاحظات..."
              value={filter.search ?? ""}
              onChange={handleSearchChange}
              className="pr-8 h-8 text-sm"
              aria-label="البحث في عناوين IP"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={filter.status ?? ""}
              onChange={handleStatusChange}
              className={selectClass}
              aria-label="تصفية حسب الحالة التشغيلية"
            >
              <option value="">جميع الحالات</option>
              <option value="FREE">متاح (FREE)</option>
              <option value="RESERVED">محجوز (RESERVED)</option>
            </select>

            <select
              value={
                filter.isArchived === undefined
                  ? ""
                  : filter.isArchived
                    ? "true"
                    : "false"
              }
              onChange={handleArchivedChange}
              className={selectClass}
              aria-label="تصفية حسب الأرشفة"
            >
              <option value="">جميع السجلات</option>
              <option value="false">نشط فقط</option>
              <option value="true">مؤرشف فقط</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="ml-1 h-3.5 w-3.5" />
            إعادة الضبط
          </Button>
        )}
      </div>

      {/* ── Data Views (Loading, Error, Empty, Ready) ─────────────── */}
      {data.kind === "loading" && (
        <div className="rounded-xl border bg-card p-8">
          <LoadingState label="جارٍ تحميل عناوين IP..." />
        </div>
      )}

      {data.kind === "error" && (
        <div className="rounded-xl border bg-card p-8">
          <ErrorState message={data.message} onRetry={data.retry} />
        </div>
      )}

      {data.kind === "empty" && (
        <div className="rounded-xl border bg-card p-8">
          <EmptyState
            title="لا توجد عناوين IP"
            description={
              hasActiveFilters
                ? "لا توجد عناوين مطابقة لشروط التصفية الحالية."
                : "لم يتم تسجيل أي عناوين IPv4 بعد."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  إلغاء التصفية
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {data.kind === "ready" && (
        <>
          {data.value.items.length === 0 ? (
            <div className="rounded-xl border bg-card p-8">
              <EmptyState
                title="لا توجد نتائج"
                description="لم يتم العثور على أي عناوين مطابقة للبحث."
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={handleResetFilters}>
                      إلغاء التصفية
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="قائمة عناوين IPv4">
                  <thead>
                    <tr className="border-b bg-muted/50 text-right font-medium text-muted-foreground">
                      <th scope="col" className="px-4 py-3">
                        عنوان IP
                      </th>
                      <th scope="col" className="px-4 py-3">
                        الحالة
                      </th>
                      <th scope="col" className="px-4 py-3">
                        الأرشفة
                      </th>
                      <th scope="col" className="px-4 py-3">
                        الملاحظات
                      </th>
                      <th scope="col" className="px-4 py-3 hidden lg:table-cell">
                        تاريخ الإضافة
                      </th>
                      {hasAnyActionCapability && (
                        <th scope="col" className="px-4 py-3 text-left">
                          الإجراءات
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.value.items.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        {/* Address */}
                        <td className="px-4 py-3 font-mono font-semibold text-foreground text-left dir-ltr">
                          <div className="flex items-center gap-2 justify-end md:justify-start">
                            <Network className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{row.address}</span>
                          </div>
                        </td>

                        {/* Operational Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <IpStatusBadge status={row.status} />
                        </td>

                        {/* Archived Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <IpArchivedBadge isArchived={row.isArchived} />
                        </td>

                        {/* Notes */}
                        <td
                          className="px-4 py-3 max-w-xs truncate text-muted-foreground"
                          title={row.notes ?? undefined}
                        >
                          {row.notes?.trim() ? row.notes : "—"}
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground hidden lg:table-cell">
                          {formatDate(row.createdAt)}
                        </td>

                        {/* Actions */}
                        {hasAnyActionCapability && (
                          <td className="px-4 py-3 whitespace-nowrap text-left">
                            <div className="flex items-center gap-1 justify-end">
                              {/* Edit Notes */}
                              {capabilities.edit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => onSelectEdit?.(row)}
                                  title="تعديل الملاحظات"
                                  aria-label={`تعديل ملاحظات ${row.address}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline mr-1">ملاحظات</span>
                                </Button>
                              )}

                              {/* Reserve Action (FREE and not archived) */}
                              {capabilities.reserve &&
                                row.status === "FREE" &&
                                !row.isArchived && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                    onClick={() => onSelectAction?.(row, "reserve")}
                                    title="حجز العنوان"
                                    aria-label={`حجز العنوان ${row.address}`}
                                  >
                                    <Lock className="h-3.5 w-3.5" />
                                    <span className="hidden xl:inline mr-1">حجز</span>
                                  </Button>
                                )}

                              {/* Release Action (RESERVED and not archived) */}
                              {capabilities.reserve &&
                                row.status === "RESERVED" &&
                                !row.isArchived && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
                                    onClick={() => onSelectAction?.(row, "release")}
                                    title="تحرير العنوان"
                                    aria-label={`تحرير العنوان ${row.address}`}
                                  >
                                    <Unlock className="h-3.5 w-3.5" />
                                    <span className="hidden xl:inline mr-1">تحرير</span>
                                  </Button>
                                )}

                              {/* Archive Action (FREE only and not currently archived) */}
                              {capabilities.archive &&
                                !row.isArchived &&
                                row.status === "FREE" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                    onClick={() => onSelectAction?.(row, "archive")}
                                    title="أرشفة العنوان"
                                    aria-label={`أرشفة العنوان ${row.address}`}
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                    <span className="hidden xl:inline mr-1">أرشفة</span>
                                  </Button>
                                )}

                              {/* Unarchive Action (Archived only) */}
                              {capabilities.archive && row.isArchived && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                                  onClick={() => onSelectAction?.(row, "unarchive")}
                                  title="إلغاء الأرشفة"
                                  aria-label={`إلغاء أرشفة العنوان ${row.address}`}
                                >
                                  <ArchiveRestore className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline mr-1">استعادة</span>
                                </Button>
                              )}

                              {/* Audit History */}
                              {capabilities.history && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => onViewHistory?.(row)}
                                  title="سجل التدقيق"
                                  aria-label={`سجل تدقيق ${row.address}`}
                                >
                                  <History className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline mr-1">السجل</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────────────────── */}
              <div className="border-t p-2">
                <TablePagination
                  page={data.value.page}
                  totalPages={Math.max(
                    1,
                    Math.ceil(data.value.total / data.value.pageSize)
                  )}
                  total={data.value.total}
                  onPageChange={onPageChange}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
