"use client";

import React, { useState } from "react";
import {
  Globe,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import type { IpFormValues } from "./types";

export interface IpFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: IpFormValues) => Promise<void>;
  mode: "create" | "editNotes";
  initialValues?: { address?: string; notes?: string };
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;

export function validateIpv4Host(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return "عنوان IP مطلوب";
  }
  if (trimmed.includes("/")) {
    return "لا يُسمح بنطاقات CIDR، أدخل عنوان IPv4 فردي فقط (بدون /)";
  }
  if (trimmed.includes(":")) {
    return "لا يُسمح بعناوين IPv6، أدخل عنوان IPv4 صالح فقط";
  }
  if (!IPV4_REGEX.test(trimmed)) {
    return "يجب إدخال عنوان IPv4 صالح (مثال: 192.168.1.50) بحيث لا تتجاوز أي خانة 255";
  }
  return null;
}

export function IpForm({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialValues,
  isSubmitting = false,
  errorMessage = null,
}: IpFormProps) {
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [clientError, setClientError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (mode === "create") {
      const valError = validateIpv4Host(address);
      if (valError) {
        setClientError(valError);
        return;
      }
    }

    try {
      await onSubmit({
        address: address.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      onClose();
    } catch {
      // Retain form inputs upon conflict/error
    }
  };

  const isEditMode = mode === "editNotes";
  const displayError = clientError || errorMessage;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
      data-testid="ip-form-dialog"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ip-form-title" className="text-lg font-bold text-foreground">
                {isEditMode ? "تعديل ملاحظات عنوان IP" : "تسجيل عنوان IP جديد"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode
                  ? "تعديل الملاحظات الوصفية الخاصة بهذا العنوان في السجل المركزي."
                  : "إضافة عنوان IPv4 فردي جديد إلى مجموعة العناوين المتاحة (FREE)."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" data-testid="ip-form">
          {displayError && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              data-testid="ip-form-error"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{displayError}</div>
            </div>
          )}

          {/* IPv4 Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              عنوان IPv4 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isEditMode || isSubmitting}
              placeholder="مثال: 192.168.1.100"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm dir-ltr text-left outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="ip-address-input"
            />
            {!isEditMode && (
              <p className="text-[11px] text-muted-foreground">
                يقبل عناوين IPv4 الفردية فقط (بدون بادئات CIDR مثل /24 وبدون عناوين IPv6).
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              الملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder="أي ملاحظات تخص الاستخدام أو الموقع الشبكي..."
              className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:opacity-60"
              data-testid="ip-notes-input"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              data-testid="ip-form-cancel-btn"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-teal-600 text-xs font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
              data-testid="ip-form-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : isEditMode ? (
                "حفظ الملاحظات"
              ) : (
                "تسجيل العنوان"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
