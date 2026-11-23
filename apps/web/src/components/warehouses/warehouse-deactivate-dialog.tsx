"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, PowerOff, ShieldAlert, X } from "lucide-react";
import type { WarehouseRow } from "./types";

export interface WarehouseDeactivateDialogProps {
  warehouse: WarehouseRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (warehouseId: string) => Promise<void> | void;
  isPending?: boolean;
  error?: string | null;
  conflict?: string | null;
}

export function WarehouseDeactivateDialog({
  warehouse,
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
  error = null,
  conflict = null,
}: WarehouseDeactivateDialogProps) {
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen || !warehouse) return null;

  const loading = isPending || localPending;
  const activeError = conflict || error || localError;

  async function handleConfirm() {
    if (!warehouse || loading) return;

    try {
      setLocalPending(true);
      setLocalError(null);
      await onConfirm(warehouse.id);
      onClose();
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "تعذر تعطيل المخزن. يرجى مراجعة تبعيات المخزن وإعادة المحاولة."
      );
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-dialog-title"
      aria-describedby="deactivate-dialog-desc"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-card p-6 shadow-xl dark:border-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <PowerOff className="h-5 w-5" />
            </div>
            <div>
              <h2 id="deactivate-dialog-title" className="text-lg font-bold text-foreground">
                تعطيل المخزن: {warehouse.name}
              </h2>
              <p id="deactivate-dialog-desc" className="text-xs text-muted-foreground mt-0.5">
                تأكيد إجراء التعطيل الإداري للمخزن وإيقاف العمليات التشغيلية الجديدة.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="إغلاق نافذة التعطيل"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="my-5 space-y-4 text-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="font-semibold text-foreground">تفاصيل المخزن:</p>
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">الاسم:</span> {warehouse.name}
              </p>
              <p>
                <span className="font-medium text-foreground">العنوان:</span> {warehouse.address}
              </p>
              <p>
                <span className="font-medium text-foreground">الحالة الحالية:</span>{" "}
                <span className="font-medium text-teal-600 dark:text-teal-400">نشط</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold">تنبيه تشغيلي حول التعطيل:</p>
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  سيتم تغيير حالة المخزن إلى <strong>معطل</strong>. لا يمكن إنشاء حركات مخزون جديدة أو
                  تعيين موظفين أو تسجيل حضور عبر سياجه الجغرافي. تُحفظ كافة السجلات التاريخية السابقة
                  دون حذف.
                </p>
              </div>
            </div>
          </div>

          {/* 409 Conflict / Backend Error Alert */}
          {activeError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="text-xs">
                  <p className="font-semibold">تعذر إتمام التعطيل (تعارض في البيانات):</p>
                  <p className="mt-1 leading-relaxed">{activeError}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium hover:bg-muted disabled:opacity-50 dark:border-slate-800"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
            {loading ? "جاري التعطيل..." : "تأكيد التعطيل"}
          </button>
        </div>
      </div>
    </div>
  );
}
