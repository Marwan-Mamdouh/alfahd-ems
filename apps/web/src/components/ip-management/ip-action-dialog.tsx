"use client";

import { useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Loader2,
  Lock,
  Unlock,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type { IpActionDialogProps, IpActionType } from "./types";

interface ActionMeta {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "destructive" | "outline";
  icon: typeof Lock;
  colorClass: string;
}

const ACTION_CONFIG: Record<IpActionType, ActionMeta> = {
  reserve: {
    title: "حجز عنوان IP",
    description:
      "سيتم وضع العنوان في حالة 'محجوز' (RESERVED) لحجزه للاستخدام، ولن يكون متاحاً للتعيينات الحرة.",
    confirmLabel: "تأكيد الحجز",
    variant: "default",
    icon: Lock,
    colorClass:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  release: {
    title: "تحرير عنوان IP",
    description:
      "سيتم إرجاع العنوان إلى حالة 'متاح' (FREE) ليصبح متاحاً للتعيين أو الاستخدام في الشبكة.",
    confirmLabel: "تأكيد التحرير",
    variant: "default",
    icon: Unlock,
    colorClass:
      "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  },
  archive: {
    title: "أرشفة عنوان IP",
    description:
      "سيتم نقل العنوان إلى الأرشيف. تنبيه: لا يمكن أرشفة إلا العناوين المتاحة (FREE) فقط. لن يظهر العنوان في قوائم التشغيل العادية.",
    confirmLabel: "أرشفة العنوان",
    variant: "default",
    icon: Archive,
    colorClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  unarchive: {
    title: "استعادة عنوان IP من الأرشيف",
    description:
      "سيتم إلغاء أرشفة العنوان وإعادته إلى قائمة العناوين النشطة بحالة 'متاح' (FREE).",
    confirmLabel: "استعادة العنوان",
    variant: "default",
    icon: ArchiveRestore,
    colorClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
};

/**
 * Confirmation dialog for state transitions: reserve, release, archive, unarchive.
 * Captures an optional reason and explains domain invariants clearly.
 */
export function IpActionDialog({
  isOpen,
  ip,
  action,
  mutation,
  onConfirm,
  onClose,
}: IpActionDialogProps) {
  const [reason, setReason] = useState("");

  if (!isOpen || !ip || !action) return null;

  const config = ACTION_CONFIG[action];
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.pending) return;

    await onConfirm(ip.id, action, reason.trim() ? reason.trim() : undefined);
  };

  const handleClose = () => {
    if (mutation.pending) return;
    setReason("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-action-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.colorClass}`}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="ip-action-dialog-title"
                className="text-lg font-bold text-foreground"
              >
                {config.title}
              </h2>
              <p className="font-mono text-xs text-muted-foreground dir-ltr text-right">
                {ip.address}
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {config.description}
          </p>

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

          {/* Optional Reason Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="ip-action-reason-input"
              className="block text-xs font-semibold text-foreground"
            >
              سبب الإجراء (اختياري)
            </label>
            <textarea
              id="ip-action-reason-input"
              rows={3}
              placeholder="اكتب سبب إجراء هذا التحول للتوثيق في سجل التدقيق..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.pending}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              maxLength={300}
            />
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
              disabled={mutation.pending}
              className="min-w-[100px]"
            >
              {mutation.pending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ التنفيذ...
                </>
              ) : (
                config.confirmLabel
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
