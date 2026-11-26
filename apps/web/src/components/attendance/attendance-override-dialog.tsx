"use client";

import React, { useState } from "react";
import { Loader2, AlertCircle, ShieldAlert, CheckCircle2, User, Calendar, X } from "lucide-react";
import type { AttendanceStatus, OverrideAttendanceDto } from "@alfahd/types";
import type { AttendanceRow } from "./types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AttendanceStatusBadge } from "./attendance-status-badge";

export interface AttendanceOverrideDialogProps {
  record: AttendanceRow | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (id: string, payload: OverrideAttendanceDto) => Promise<void> | void;
}

function toLocalDatetimeString(isoString?: string | null, fallbackDate?: string): string {
  if (!isoString) {
    if (fallbackDate) {
      return `${fallbackDate}T08:00`;
    }
    return "";
  }
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

export function AttendanceOverrideDialog({
  record,
  isOpen,
  isSubmitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: AttendanceOverrideDialogProps) {
  const [status, setStatus] = useState<AttendanceStatus>(() => record?.status ?? "ON_TIME");
  const [checkInDatetime, setCheckInDatetime] = useState(() => {
    const workDate = record?.workDate || record?.date;
    return toLocalDatetimeString(record?.checkInAt || record?.checkIn, workDate);
  });
  const [checkOutDatetime, setCheckOutDatetime] = useState(() =>
    toLocalDatetimeString(record?.checkOutAt || record?.checkOut)
  );
  const [overrideReason, setOverrideReason] = useState(() => record?.overrideReason ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [prevRecordId, setPrevRecordId] = useState<string | null>(record?.id ?? null);

  // Synchronize state during render when record changes (React recommended pattern)
  if (record && record.id !== prevRecordId) {
    setPrevRecordId(record.id);
    setStatus(record.status ?? "ON_TIME");
    const workDate = record.workDate || record.date;
    setCheckInDatetime(toLocalDatetimeString(record.checkInAt || record.checkIn, workDate));
    setCheckOutDatetime(toLocalDatetimeString(record.checkOutAt || record.checkOut));
    setOverrideReason(record.overrideReason ?? "");
    setValidationError(null);
  }

  if (!isOpen || !record) return null;

  const isBusy = isSubmitting || localSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedReason = overrideReason.trim();
    if (!trimmedReason) {
      setValidationError("سبب التعديل مطلوب ولا يمكن أن يكون فارغاً.");
      return;
    }

    if (checkInDatetime && checkOutDatetime) {
      const inTime = new Date(checkInDatetime).getTime();
      const outTime = new Date(checkOutDatetime).getTime();
      if (!Number.isNaN(inTime) && !Number.isNaN(outTime) && outTime < inTime) {
        setValidationError("وقت الانصراف لا يمكن أن يكون قبل وقت الحضور.");
        return;
      }
    }

    const payload: OverrideAttendanceDto = {
      overrideReason: trimmedReason,
      status,
      checkInAt: checkInDatetime ? new Date(checkInDatetime).toISOString() : undefined,
      checkOutAt: checkOutDatetime ? new Date(checkOutDatetime).toISOString() : undefined,
    };

    try {
      setLocalSubmitting(true);
      await onSubmit(record.id, payload);
    } catch {
      // Input values are preserved on error so user can adjust without losing input
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isBusy) {
      setValidationError(null);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
      data-testid="attendance-override-dialog"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="override-dialog-title" className="text-lg font-bold text-foreground">
                تعديل سجل الحضور (إشراف إداري)
              </h2>
              <p className="text-xs text-muted-foreground">
                تعديل استثنائي لبيانات الحضور والانصراف مع توثيق السبب الإلزامي في سجل التدقيق.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Record Context Card */}
        <div className="mt-4 rounded-xl border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <User className="h-3.5 w-3.5 text-primary" />
              {record.employeeName}
            </span>
            <span>{record.department ?? "غير محدد"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              تاريخ العمل: {record.workDate || record.date}
            </span>
            <div className="flex items-center gap-1.5">
              <span>الحالة الحالية:</span>
              <AttendanceStatusBadge status={record.status} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Status selector */}
          <div className="space-y-1.5">
            <Label htmlFor="override-status" className="text-xs font-medium">
              حالة الحضور المعدلة
            </Label>
            <select
              id="override-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              disabled={isBusy}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="override-status-select"
            >
              <option value="ON_TIME">في الموعد (ON_TIME)</option>
              <option value="LATE">متأخر (LATE)</option>
            </select>
          </div>

          {/* Check-in datetime */}
          <div className="space-y-1.5">
            <Label htmlFor="override-check-in" className="text-xs font-medium">
              وقت الحضور المعدل
            </Label>
            <input
              id="override-check-in"
              type="datetime-local"
              value={checkInDatetime}
              onChange={(e) => setCheckInDatetime(e.target.value)}
              disabled={isBusy}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="override-check-in-input"
            />
          </div>

          {/* Check-out datetime */}
          <div className="space-y-1.5">
            <Label htmlFor="override-check-out" className="text-xs font-medium">
              وقت الانصراف المعدل (اختياري)
            </Label>
            <input
              id="override-check-out"
              type="datetime-local"
              value={checkOutDatetime}
              onChange={(e) => setCheckOutDatetime(e.target.value)}
              disabled={isBusy}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="override-check-out-input"
            />
          </div>

          {/* Reason (MANDATORY) */}
          <div className="space-y-1.5">
            <Label htmlFor="override-reason" className="text-xs font-medium text-foreground">
              سبب التعديل الإداري <span className="text-red-500">*</span>
            </Label>
            <textarea
              id="override-reason"
              rows={3}
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="اكتب مبرر التعديل بشكل واضح (مثال: إذن رسمي مسبق، عطل فني في جهاز البصمة)..."
              disabled={isBusy}
              className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              data-testid="override-reason-textarea"
            />
            <p className="text-[11px] text-muted-foreground">
              سيتم تسجيل هذا السبب واسم المشرف المنفذ ووقت التعديل في سجل النظام للأغراض الرقابية.
            </p>
          </div>

          {/* Validation or server errors */}
          {(validationError || errorMessage) && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              data-testid="override-error-alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError || errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isBusy}
              data-testid="override-cancel-btn"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isBusy}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="override-submit-btn"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد التعديل</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
