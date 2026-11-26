"use client";

import React, { useState } from "react";
import {
  Lock,
  Unlock,
  Archive,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { IpStatus } from "@alfahd/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IpAddressRow, IpActionType } from "./types";

export interface IpActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  action: IpActionType | null;
  ip: IpAddressRow | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

interface ActionConfig {
  title: string;
  description: string;
  buttonLabel: string;
  buttonClass: string;
  icon: React.ComponentType<{ className?: string }>;
  iconContainerClass: string;
  defaultReason: string;
}

const ACTION_CONFIGS: Record<IpActionType, ActionConfig> = {
  reserve: {
    title: "تأكيد حجز عنوان IP",
    description:
      "سيتم تمييز هذا العنوان كمحجوز (RESERVED) واستبعاده من حوض العناوين المتاحة للتخصيص.",
    buttonLabel: "تأكيد الحجز",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500",
    icon: Lock,
    iconContainerClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    defaultReason: "حجز يدوي من لوحة تحكم الإدارة",
  },
  release: {
    title: "تأكيد تحرير عنوان IP",
    description:
      "سيتم تحرير هذا العنوان وإعادته إلى حوض العناوين المتاحة (FREE) ليصبح قابلاً للتخصيص مجدداً.",
    buttonLabel: "تأكيد التحرير",
    buttonClass:
      "bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500",
    icon: Unlock,
    iconContainerClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    defaultReason: "تحرير العنوان وإعادته للمخزون الحر",
  },
  archive: {
    title: "تأكيد أرشفة عنوان IP",
    description:
      "سيتم أرشفة هذا العنوان وإخراجه من التداول النشط. لا يمكن أرشفة العناوين المحجوزة قبل تحريرها.",
    buttonLabel: "تأكيد الأرشفة",
    buttonClass:
      "bg-slate-700 hover:bg-slate-800 text-white focus-visible:ring-slate-500 dark:bg-slate-600 dark:hover:bg-slate-700",
    icon: Archive,
    iconContainerClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    defaultReason: "أرشفة يدوية من لوحة التحكم",
  },
  unarchive: {
    title: "تأكيد إلغاء أرشفة عنوان IP",
    description:
      "سيتم إلغاء أرشفة هذا العنوان وإعادته إلى قائمة العناوين النشطة المتاحة في النظام.",
    buttonLabel: "تأكيد إلغاء الأرشفة",
    buttonClass: "bg-teal-600 hover:bg-teal-700 text-white focus-visible:ring-teal-500",
    icon: RotateCcw,
    iconContainerClass: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    defaultReason: "إلغاء أرشفة العنوان وإعادته للنشط",
  },
};

export function buildActionDialogContextKey(
  isOpen: boolean,
  action: IpActionType | null,
  ipId?: string | null
): string {
  return `${isOpen ? "open" : "closed"}-${action ?? "none"}-${ipId ?? "none"}`;
}

export function IpActionDialog({
  isOpen,
  onClose,
  onConfirm,
  action,
  ip,
  isSubmitting = false,
  errorMessage = null,
}: IpActionDialogProps) {
  const contextKey = buildActionDialogContextKey(isOpen, action, ip?.id);
  const [reasonState, setReasonState] = useState<{ key: string; value: string }>({
    key: contextKey,
    value: "",
  });

  // Reset reason synchronously whenever dialog open state, action, or target IP changes
  const reason = reasonState.key === contextKey ? reasonState.value : "";

  if (!isOpen || !action || !ip) return null;

  const config = ACTION_CONFIGS[action];
  const Icon = config.icon;

  const isReservedArchiveBlocked =
    action === "archive" && ip.status === IpStatus.RESERVED;

  const handleClose = () => {
    if (isSubmitting) return;
    setReasonState({ key: contextKey, value: "" });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReservedArchiveBlocked || isSubmitting) return;

    const trimmedReason = reason.trim() || config.defaultReason;
    await onConfirm(trimmedReason);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-action-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
      data-testid="ip-action-dialog"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconContainerClass}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ip-action-title" className="text-lg font-bold text-foreground">
                {config.title}
              </h2>
              <p className="text-xs text-muted-foreground font-mono dir-ltr text-right">
                {ip.address}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground"
            data-testid="action-close-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" data-testid="ip-action-form">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              data-testid="ip-action-error"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {isReservedArchiveBlocked ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200"
              data-testid="ip-action-blocked-warning"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <span className="font-semibold block">لا يمكن إتمام الأرشفة</span>
                <p>
                  هذا العنوان محجوز حالياً (RESERVED). يجب تحرير العنوان أولاً قبل التمكن من أرشفته.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {config.description}
            </p>
          )}

          {/* Reason Input */}
          {!isReservedArchiveBlocked && (
            <div className="space-y-1.5">
              <Label htmlFor="action-reason" className="text-xs font-medium text-foreground">
                سبب الإجراء (اختياري)
              </Label>
              <Input
                id="action-reason"
                type="text"
                value={reason}
                onChange={(e) =>
                  setReasonState({ key: contextKey, value: e.target.value })
                }
                disabled={isSubmitting}
                placeholder={config.defaultReason}
                className="h-10 text-xs focus-visible:border-teal-500 focus-visible:ring-teal-500/10"
                data-testid="action-reason-input"
              />
              <p className="text-[11px] text-muted-foreground">
                سيتم تدوين هذا السبب في سجل التدقيق المالي والتشغيلي للعنوان.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs"
              data-testid="action-cancel-btn"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isReservedArchiveBlocked}
              className={`h-9 px-5 text-xs ${config.buttonClass}`}
              data-testid="action-confirm-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  جاري التنفيذ...
                </>
              ) : (
                config.buttonLabel
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
