"use client";

import React, { useState } from "react";
import { Globe, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const contextKey = `${isOpen ? "open" : "closed"}-${mode}-${initialValues?.address ?? "new"}-${initialValues?.notes ?? ""}`;
  const [formState, setFormState] = useState<{
    key: string;
    address: string;
    notes: string;
    clientError: string | null;
  }>({
    key: contextKey,
    address: initialValues?.address ?? "",
    notes: initialValues?.notes ?? "",
    clientError: null,
  });
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const activeState =
    formState.key === contextKey
      ? formState
      : {
          key: contextKey,
          address: initialValues?.address ?? "",
          notes: initialValues?.notes ?? "",
          clientError: null,
        };

  const { address, notes, clientError } = activeState;
  const submitting = isSubmitting || localSubmitting;

  if (!isOpen) return null;

  const resetForm = () => {
    setFormState({
      key: contextKey,
      address: initialValues?.address ?? "",
      notes: initialValues?.notes ?? "",
      clientError: null,
    });
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setFormState({ ...activeState, clientError: null });

    if (mode === "create") {
      const valError = validateIpv4Host(address);
      if (valError) {
        setFormState({ ...activeState, clientError: valError });
        return;
      }
    }

    try {
      setLocalSubmitting(true);
      await onSubmit({
        address: address.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      resetForm();
      onClose();
    } catch {
      // Retain form inputs upon conflict/server error
    } finally {
      setLocalSubmitting(false);
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

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={submitting}
            onClick={handleClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground"
            data-testid="ip-form-close-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" data-testid="ip-form">
          {displayError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              data-testid="ip-form-error"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{displayError}</div>
            </div>
          )}

          {/* IPv4 Address */}
          <div className="space-y-1.5">
            <Label htmlFor="ip-address-input" className="text-xs font-medium text-foreground">
              عنوان IPv4 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ip-address-input"
              type="text"
              value={address}
              onChange={(e) =>
                setFormState({ ...activeState, address: e.target.value })
              }
              disabled={isEditMode || submitting}
              placeholder="مثال: 192.168.1.100"
              className="h-10 font-mono text-sm dir-ltr text-left focus-visible:border-teal-500 focus-visible:ring-teal-500/10"
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
            <Label htmlFor="ip-notes-input" className="text-xs font-medium text-foreground">
              الملاحظات (اختياري)
            </Label>
            <textarea
              id="ip-notes-input"
              value={notes}
              onChange={(e) =>
                setFormState({ ...activeState, notes: e.target.value })
              }
              disabled={submitting}
              rows={3}
              placeholder="أي ملاحظات تخص الاستخدام أو الموقع الشبكي..."
              className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:opacity-60"
              data-testid="ip-notes-input"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="h-9 px-4 text-xs"
              data-testid="ip-form-cancel-btn"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 bg-teal-600 text-xs text-white hover:bg-teal-700"
              data-testid="ip-form-submit-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : isEditMode ? (
                "حفظ الملاحظات"
              ) : (
                "تسجيل العنوان"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
