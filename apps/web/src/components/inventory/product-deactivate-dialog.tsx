"use client";

import { useState } from "react";
import { AlertTriangle, Archive, Info, Loader2, X } from "lucide-react";
import type { InventoryItemRow, ProductRow } from "./types";

export interface ProductDeactivateDialogProps {
  item: InventoryItemRow | ProductRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: InventoryItemRow | ProductRow) => Promise<void> | void;
  isSubmitting?: boolean;
  conflict?: string | null;
  error?: string | null;
}

export function ProductDeactivateDialog({
  item,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  conflict = null,
  error = null,
}: ProductDeactivateDialogProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const loading = isSubmitting || localSubmitting;
  const activeError = conflict || error || localError;

  async function handleConfirm() {
    if (!item || loading) return;

    setLocalError(null);
    try {
      setLocalSubmitting(true);
      await onConfirm(item);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
      ) {
        setLocalError(
          (err as { response: { data: { message: string } } }).response.data.message
        );
      } else {
        setLocalError("تعذر تعطيل الصنف. يرجى مراجعة تبعيات المخزون وإعادة المحاولة.");
      }
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-dialog-title"
      aria-describedby="deactivate-dialog-desc"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="deactivate-dialog-title"
                className="text-lg font-bold text-foreground"
              >
                تعطيل وأرشفة الصنف
              </h2>
              <p id="deactivate-dialog-desc" className="text-xs text-muted-foreground">
                إيقاف تداول الصنف في العمليات التشغيلية الجديدة مع الحفاظ على البيانات التاريخية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Details Card */}
        <div className="mt-5 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.sku ? `${item.sku} • ` : ""}
                {item.model}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {item.category}
            </span>
          </div>

          {item.description && (
            <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Compliance Notice: No Hard Deletes */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">سياسة الحفاظ على البيانات (No-Hard-Delete Compliance):</p>
              <p className="leading-relaxed opacity-90">
                لن يتم حذف هذا الصنف أو سجلاته نهائياً من قاعدة البيانات. سيتم فقط تعيين حالته إلى
                &quot;معطّل&quot; لحظر إنشاء أوامر صرف أو استلام أو تحويل جديدة له، مع بقاء كافة الحركات
                التاريخية والأرصدة الموثقة محفوظة في سجل التدقيق.
              </p>
            </div>
          </div>
        </div>

        {/* 409 Conflict / Server Error Alert */}
        {activeError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">تعذر إتمام التعطيل (تعارض في البيانات):</p>
                <p className="mt-1 leading-relaxed">{activeError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {loading ? "جاري التعطيل..." : "تأكيد التعطيل"}
          </button>
        </div>
      </div>
    </div>
  );
}
