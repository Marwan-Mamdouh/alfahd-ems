"use client";

import {
  Clock,
  History,
  ShieldAlert,
  User,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { IpStatusBadge } from "./ip-status-badge";
import type { IpHistoryAction, IpHistoryDrawerProps } from "./types";

const ACTION_LABELS: Record<
  IpHistoryAction,
  { label: string; className: string }
> = {
  CREATE: {
    label: "إنشاء العنوان",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  RESERVE: {
    label: "حجز",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  },
  RELEASE: {
    label: "تحرير",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300",
  },
  ARCHIVE: {
    label: "أرشفة",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  },
  UNARCHIVE: {
    label: "استعادة من الأرشيف",
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  UPDATE_METADATA: {
    label: "تحديث الملاحظات",
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-300",
  },
};

function formatDateTime(dateString: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Slide-over drawer presenting the immutable audit history of an IP address.
 * Corresponds to GET /ip-addresses/:id/history.
 */
export function IpHistoryDrawer({
  isOpen,
  ip,
  canView,
  data,
  onClose,
}: IpHistoryDrawerProps) {
  if (!isOpen || !ip) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold">
                سجل تدقيق العنوان
              </SheetTitle>
              <SheetDescription className="font-mono text-xs text-muted-foreground dir-ltr text-right">
                {ip.address}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!canView ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              <p className="font-semibold text-foreground">
                غير مصرح بعرض سجل التدقيق
              </p>
              <p className="text-xs">
                عرض تاريخ العمليات مخصص لمديري النظام فقط.
              </p>
            </div>
          ) : data.kind === "loading" ? (
            <LoadingState label="جارٍ تحميل سجل التدقيق..." />
          ) : data.kind === "error" ? (
            <ErrorState message={data.message} onRetry={data.retry} />
          ) : data.kind === "empty" || data.value.length === 0 ? (
            <EmptyState
              title="لا يوجد سجل تاريخي"
              description="لم يتم تسجيل أي عمليات تدقيق على هذا العنوان بعد."
            />
          ) : (
            <div className="relative border-r border-border mr-3 pr-4 space-y-6">
              {data.value.map((entry) => {
                const actionMeta = ACTION_LABELS[entry.action] ?? {
                  label: entry.action,
                  className: "border-border bg-muted text-muted-foreground",
                };

                return (
                  <div key={entry.id} className="relative group">
                    {/* Timeline Dot */}
                    <span className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />

                    <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
                      {/* Action & Date */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                            actionMeta.className
                          )}
                        >
                          {actionMeta.label}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(entry.createdAt)}</span>
                        </div>
                      </div>

                      {/* State Transition */}
                      {entry.fromStatus !== entry.toStatus && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>التحول:</span>
                          <IpStatusBadge status={entry.fromStatus} />
                          <span>←</span>
                          <IpStatusBadge status={entry.toStatus} />
                        </div>
                      )}

                      {/* Reason */}
                      {entry.reason && (
                        <div className="rounded-lg bg-muted/50 p-2 text-xs">
                          <span className="font-medium text-foreground">
                            السبب:{" "}
                          </span>
                          <span className="text-muted-foreground">
                            {entry.reason}
                          </span>
                        </div>
                      )}

                      {/* Actor Information */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <User className="h-3 w-3" />
                        <span>المنفذ:</span>
                        <span className="font-mono text-xs">{entry.actorId}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
