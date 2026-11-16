"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Network, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { IpCreateModalProps } from "./types";

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * Validates whether an input is a valid single IPv4 host.
 * Strictly rejects CIDR notation, IPv6, and out-of-range octets.
 */
export function validateIpv4Address(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return "عنوان IP مطلوب.";
  }
  if (trimmed.includes("/")) {
    return "يجب إدخال عنوان IPv4 فردي فقط، وتنسيق CIDR (مثل /24) غير مسموح.";
  }
  if (trimmed.includes(":")) {
    return "عناوين IPv6 غير مدعومة، يرجى إدخال عنوان IPv4 صحيح.";
  }
  if (!IPV4_REGEX.test(trimmed)) {
    return "صيغة عنوان IPv4 غير صحيحة (مثال صحيح: 192.168.1.10).";
  }
  return null;
}

/**
 * Modal dialog for creating a single IPv4 host address.
 * Validates input client-side while preserving values on mutation failure.
 */
export function IpCreateModal({
  isOpen,
  mutation,
  onSubmit,
  onClose,
}: IpCreateModalProps) {
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.pending) return;

    const error = validateIpv4Address(address);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    await onSubmit({
      address: address.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
    });
  };

  const handleClose = () => {
    if (mutation.pending) return;
    setValidationError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-ip-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="create-ip-modal-title"
                className="text-lg font-bold text-foreground"
              >
                إضافة عنوان IPv4 جديد
              </h2>
              <p className="text-xs text-muted-foreground">
                تسجيل عنوان IP فردي بحالة متاح (FREE)
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={mutation.pending}
            className="h-8 w-8 p-0"
            aria-label="إغلاق النافذة"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Server Error Alert */}
          {mutation.error && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{mutation.error}</span>
            </div>
          )}

          {/* Client Validation Error Alert */}
          {validationError && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* IP Address Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="ip-address-input"
              className="block text-xs font-semibold text-foreground"
            >
              عنوان IP <span className="text-destructive">*</span>
            </label>
            <Input
              id="ip-address-input"
              type="text"
              placeholder="192.168.1.100"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={mutation.pending}
              className="font-mono text-left dir-ltr h-9 text-sm"
              required
              aria-required="true"
              aria-invalid={Boolean(validationError || mutation.fieldErrors?.address)}
            />
            {mutation.fieldErrors?.address && (
              <p className="text-xs text-destructive">
                {mutation.fieldErrors.address}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              أدخل عنوان IPv4 فردي فقط. النطاقات وتنسيق CIDR غير مسموح بها.
            </p>
          </div>

          {/* Notes Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="ip-notes-input"
              className="block text-xs font-semibold text-foreground"
            >
              الملاحظات (اختياري)
            </label>
            <textarea
              id="ip-notes-input"
              rows={3}
              placeholder="وصف استخدام العنوان، أو الموقع، أو ملاحظات خاصة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.pending}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              maxLength={500}
            />
            {mutation.fieldErrors?.notes && (
              <p className="text-xs text-destructive">
                {mutation.fieldErrors.notes}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={mutation.pending}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.pending || !address.trim()}
              className="min-w-[100px]"
            >
              {mutation.pending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                <>
                  <Plus className="ml-1.5 h-4 w-4" />
                  إضافة العنوان
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
