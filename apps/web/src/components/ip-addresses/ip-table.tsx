"use client";

import React from "react";
import {
  Globe,
  Lock,
  Unlock,
  Archive,
  RotateCcw,
  History,
  FileEdit,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { IpAddressRow } from "./types";

export interface IpTableProps {
  items: IpAddressRow[];
  isLoading?: boolean;
  canManage?: boolean;
  onReserve?: (row: IpAddressRow) => void;
  onRelease?: (row: IpAddressRow) => void;
  onArchive?: (row: IpAddressRow) => void;
  onUnarchive?: (row: IpAddressRow) => void;
  onEditNotes?: (row: IpAddressRow) => void;
  onViewHistory?: (row: IpAddressRow) => void;
}

export function IpTable({
  items,
  isLoading = false,
  canManage = true,
  onReserve,
  onRelease,
  onArchive,
  onUnarchive,
  onEditNotes,
  onViewHistory,
}: IpTableProps) {
  if (isLoading) {
    return (
      <div
        className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center"
        data-testid="ip-table-loading"
      >
        <Loader2 className="size-8 animate-spin text-teal-600 dark:text-teal-400" />
        <p className="text-sm text-muted-foreground">جاري تحميل بيانات عناوين IP...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center"
        data-testid="ip-table-empty"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Globe className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">لا توجد عناوين IP مطابقة</h3>
          <p className="text-sm text-muted-foreground">
            لم يتم العثور على أي عناوين IP تطابق معايير البحث أو التصفية المحددة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs" data-testid="ip-table">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-4 text-right">عنوان IPv4</th>
              <th className="px-5 py-4 text-center">الحالة التشغيلية</th>
              <th className="px-5 py-4 text-center">حالة الأرشفة</th>
              <th className="px-5 py-4 text-right">الملاحظات</th>
              <th className="px-5 py-4 text-right">تاريخ الإضافة</th>
              {canManage && <th className="px-5 py-4 text-center">الإجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((row) => {
              const isReserved = row.status === "RESERVED";
              const isFree = row.status === "FREE";
              const isArchived = row.isArchived;

              return (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/30"
                  data-testid={`ip-row-${row.id}`}
                >
                  {/* IP Address */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground shrink-0" />
                      <span
                        className="font-mono font-medium text-foreground dir-ltr text-left"
                        data-testid={`ip-address-${row.id}`}
                      >
                        {row.address}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4 text-center">
                    {isFree ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        data-testid={`ip-status-free-${row.id}`}
                      >
                        <CheckCircle2 className="size-3.5" />
                        متاح (FREE)
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        data-testid={`ip-status-reserved-${row.id}`}
                      >
                        <Lock className="size-3.5" />
                        محجوز (RESERVED)
                      </span>
                    )}
                  </td>

                  {/* Archive Badge */}
                  <td className="px-5 py-4 text-center">
                    {isArchived ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        data-testid={`ip-archived-badge-${row.id}`}
                      >
                        <Archive className="size-3.5" />
                        مؤرشف
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
                        data-testid={`ip-active-badge-${row.id}`}
                      >
                        نشط
                      </span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="px-5 py-4 text-muted-foreground max-w-[220px] truncate" title={row.notes ?? ""}>
                    {row.notes ? row.notes : <span className="text-muted-foreground/50">—</span>}
                  </td>

                  {/* Date */}
                  <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      <span>{new Date(row.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </td>

                  {/* Admin Actions */}
                  {canManage && (
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* Reserve Action (when FREE and !isArchived) */}
                        {isFree && !isArchived && (
                          <button
                            type="button"
                            onClick={() => onReserve?.(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
                            title="حجز العنوان"
                            data-testid={`reserve-btn-${row.id}`}
                          >
                            <Lock className="size-3.5" />
                            حجز
                          </button>
                        )}

                        {/* Release Action (when RESERVED) */}
                        {isReserved && (
                          <button
                            type="button"
                            onClick={() => onRelease?.(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            title="تحرير العنوان"
                            data-testid={`release-btn-${row.id}`}
                          >
                            <Unlock className="size-3.5" />
                            تحرير
                          </button>
                        )}

                        {/* Archive Action (when !isArchived) */}
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => onArchive?.(row)}
                            disabled={isReserved}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                            title={
                              isReserved
                                ? "لا يمكن أرشفة عنوان محجوز. حرره أولاً."
                                : "أرشفة العنوان"
                            }
                            data-testid={`archive-btn-${row.id}`}
                          >
                            <Archive className="size-3.5" />
                            أرشفة
                          </button>
                        )}

                        {/* Unarchive Action (when isArchived) */}
                        {isArchived && (
                          <button
                            type="button"
                            onClick={() => onUnarchive?.(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/40"
                            title="إلغاء الأرشفة"
                            data-testid={`unarchive-btn-${row.id}`}
                          >
                            <RotateCcw className="size-3.5" />
                            إلغاء الأرشفة
                          </button>
                        )}

                        {/* Edit Notes */}
                        <button
                          type="button"
                          onClick={() => onEditNotes?.(row)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="تعديل الملاحظات"
                          data-testid={`edit-notes-btn-${row.id}`}
                        >
                          <FileEdit className="size-3.5" />
                        </button>

                        {/* View History */}
                        <button
                          type="button"
                          onClick={() => onViewHistory?.(row)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="عرض سجل العمليات"
                          data-testid={`history-btn-${row.id}`}
                        >
                          <History className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
