"use client";

import { useState } from "react";
import { AlertTriangle, Archive, Info, Loader2, X } from "lucide-react";
import type { InventoryItemRow } from "./types";

interface ProductDeactivateDialogProps {
  item: InventoryItemRow;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: InventoryItemRow) => Promise<void>;
  isSubmitting?: boolean;
}

export function ProductDeactivateDialog({
  item,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: ProductDeactivateDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    setErrorMessage(null);
    try {
      await onConfirm(item);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
      ) {
        setErrorMessage(
          (err as { response: { data: { message: string } } }).response.data.message
        );
      } else {
        setErrorMessage("تعذر تعطيل الصنف. يرجى المحاولة مرة أخرى.");
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-dialog-title"
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
              <p className="text-xs text-muted-foreground">
                إيقاف تداول الصنف في العمليات التشغيلية الجديدة مع الحفاظ على البيانات التاريخية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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
        </div>

        {/* Policy notice */}
        <div className="mt-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1">
            <p className="font-medium">سياسة عدم الحذف الفعلي (No-Hard-Delete Compliance):</p>
            <p className="leading-relaxed">
              هذه العملية تقوم بتعطيل الصنف فقط وإخفائه من قوائم التوريد والحركات المخزنية الجديدة.
              لن يتم حذف أي سجل حركة مخزنية أو ارتباط أجهزة راوتر سابقة من قاعدة البيانات.
            </p>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold">تعذر إتمام عملية التعطيل:</p>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-800"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التعطيل...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                تأكيد التعطيل
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

