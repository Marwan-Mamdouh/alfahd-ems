"use client";

import React from "react";
import {
  History,
  Clock,
  User,
  ArrowRight,
  Loader2,
  FileText,
  ShieldAlert,
  X,
} from "lucide-react";
import { useIpHistory } from "@/core/query/use-ip-addresses";
import type { IpHistoryAction } from "@alfahd/types";

export interface IpHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ipId: string | null;
  ipAddress?: string;
}

const ACTION_LABELS: Record<IpHistoryAction, { label: string; badgeClass: string }> = {
  CREATE: {
    label: "إنشاء (CREATE)",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  RESERVE: {
    label: "حجز (RESERVE)",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  RELEASE: {
    label: "تحرير (RELEASE)",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  ARCHIVE: {
    label: "أرشفة (ARCHIVE)",
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  UNARCHIVE: {
    label: "إلغاء الأرشفة (UNARCHIVE)",
    badgeClass: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  UPDATE_METADATA: {
    label: "تعديل الملاحظات (UPDATE_METADATA)",
    badgeClass: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  },
};

export function IpHistoryDialog({
  isOpen,
  onClose,
  ipId,
  ipAddress,
}: IpHistoryDialogProps) {
  const { history, isLoading, isError, error } = useIpHistory(ipId ?? undefined, {
    enabled: isOpen && Boolean(ipId),
  });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
      data-testid="ip-history-dialog"
    >
      <div className="relative max-h-[85vh] w-full max-w-[650px] overflow-hidden flex flex-col rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ip-history-title" className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>سجل عمليات العنوان:</span>
                <span className="font-mono text-sm dir-ltr">{ipAddress ?? ""}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                عرض السجل التدقيقي الكامل لجميع التحولات والعمليات المنفذة على هذا العنوان.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground" data-testid="ip-history-loading">
              <Loader2 className="size-6 animate-spin text-teal-600" />
              <p className="text-xs">جاري تحميل سجل العمليات...</p>
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{error || "فشل تحميل سجل العمليات"}</span>
            </div>
          )}

          {!isLoading && !isError && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <FileText className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs">لا توجد عمليات مسجلة لهذا العنوان حتى الآن.</p>
            </div>
          )}

          {!isLoading &&
            !isError &&
            history.map((entry) => {
              const actionMeta = ACTION_LABELS[entry.action] ?? {
                label: entry.action,
                badgeClass: "border-border bg-muted text-muted-foreground",
              };

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs transition-colors hover:bg-muted/20"
                  data-testid={`ip-history-item-${entry.id}`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${actionMeta.badgeClass}`}
                    >
                      {actionMeta.label}
                    </span>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Clock className="size-3" />
                      <span>{new Date(entry.createdAt).toLocaleString("ar-EG")}</span>
                    </div>
                  </div>

                  {/* Transition path */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>من:</span>
                    <span className="font-semibold text-foreground font-mono">{entry.fromStatus}</span>
                    <ArrowRight className="size-3 rotate-180 text-muted-foreground" />
                    <span>إلى:</span>
                    <span className="font-semibold text-foreground font-mono">{entry.toStatus}</span>
                  </div>

                  {/* Reason if present */}
                  {entry.reason && (
                    <div className="text-muted-foreground bg-muted/40 p-2 rounded-lg text-[11px]">
                      <span className="font-medium text-foreground">السبب: </span>
                      {entry.reason}
                    </div>
                  )}

                  {/* Actor ID */}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                    <User className="size-3" />
                    <span>المستخدم:</span>
                    <span className="font-mono">{entry.actorId}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
