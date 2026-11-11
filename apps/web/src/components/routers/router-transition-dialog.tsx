"use client";

import { useState, useMemo, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  ALLOWED_ROUTER_TRANSITIONS,
  type RouterStatus,
} from "@alfahd/types";

import type { RouterRow, RouterTransitionFormValues } from "./types";

interface WarehouseOption {
  id: string;
  name: string;
}

interface RouterTransitionDialogProps {
  router: RouterRow;
  warehouses: WarehouseOption[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RouterTransitionFormValues) => void | Promise<void>;
  onOpenAssign?: () => void;
  isSubmitting?: boolean;
}

const STATUS_LABELS: Record<RouterStatus, string> = {
  AVAILABLE: "متاح بالمخزن (AVAILABLE)",
  ASSIGNED_TO_TECHNICIAN: "بعهدة الفني (ASSIGNED_TO_TECHNICIAN)",
  INSTALLED_AT_CUSTOMER: "مركب لدى عميل (INSTALLED_AT_CUSTOMER)",
  RETURNED: "مرتجع للمخزن (RETURNED)",
  DAMAGED: "تالف (DAMAGED)",
  UNDER_REPAIR: "قيد الصيانة (UNDER_REPAIR)",
  LOST: "مفقود (LOST)",
  DECOMMISSIONED: "مكهن / خارج الخدمة (DECOMMISSIONED)",
};

const STATUS_BADGE_CLASS: Record<RouterStatus, string> = {
  AVAILABLE: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  ASSIGNED_TO_TECHNICIAN: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  INSTALLED_AT_CUSTOMER: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  RETURNED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  DAMAGED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  UNDER_REPAIR: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  LOST: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  DECOMMISSIONED: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";
const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";

export function RouterTransitionDialog({
  router,
  warehouses,
  isOpen,
  onClose,
  onSubmit,
  onOpenAssign,
  isSubmitting = false,
}: RouterTransitionDialogProps) {
  const allowedTransitions = useMemo<readonly RouterStatus[]>(
    () => ALLOWED_ROUTER_TRANSITIONS[router.status] ?? [],
    [router.status]
  );

  const [targetStatus, setTargetStatus] = useState<RouterStatus | "">("");
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(
    router.warehouseId ?? ""
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{
    status?: string;
    targetWarehouseId?: string;
    reason?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;
  const isTerminal = router.status === "LOST" || router.status === "DECOMMISSIONED";

  const needsWarehouse = targetStatus === "RETURNED" || targetStatus === "AVAILABLE";

  function validate(): boolean {
    const nextErrors: typeof errors = {};

    if (!targetStatus) {
      nextErrors.status = "يرجى تحديد الحالة المستهدفة للانتقال.";
    } else if (!allowedTransitions.includes(targetStatus)) {
      nextErrors.status = "هذا الانتقال غير مسموح به وفق محددات دورة حياة الجهاز.";
    }

    if (targetStatus === "ASSIGNED_TO_TECHNICIAN") {
      nextErrors.status = "يتم صرف الجهاز للفني عبر زر (صرف وتخصيص للفني) لتوثيق العهدة.";
    }

    if (targetStatus === "INSTALLED_AT_CUSTOMER") {
      nextErrors.status = "التركيب لدى العميل مغلق في المرحلة الحالية وبانتظار مرحلة التذاكر (M3a).";
    }

    if (needsWarehouse && !targetWarehouseId) {
      nextErrors.targetWarehouseId = "يرجى اختيار المخزن المستلم للجهاز.";
    }

    if (!reason.trim() || reason.trim().length < 3) {
      nextErrors.reason = "سبب الانتقال مطلوب ولا يقل عن 3 أحرف لتوثيق السجل الرقابي.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    try {
      setLocalSubmitting(true);
      setSubmitError(null);

      await onSubmit({
        status: targetStatus as RouterStatus,
        reason: reason.trim(),
        targetWarehouseId: needsWarehouse && targetWarehouseId ? targetWarehouseId : undefined,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء تحديث حالة الراوتر."
      );
    } finally {
      setLocalSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 id="transition-dialog-title" className="text-lg font-bold text-foreground">
                تغيير حالة دورة الراوتر
              </h2>
              <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                {router.serialNumber} — {router.productName}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="my-4 flex items-center justify-between rounded-xl bg-muted/50 p-3">
          <span className="text-xs text-muted-foreground">الحالة الحالية للجهاز:</span>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              STATUS_BADGE_CLASS[router.status] ?? ""
            }`}
          >
            {STATUS_LABELS[router.status] ?? router.status}
          </span>
        </div>

        {/* Terminal Status Warning */}
        {isTerminal ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold text-sm">حالة نهائية غير قابلة للتغيير</p>
                <p className="mt-1 text-xs leading-relaxed">
                  هذا الجهاز في حالة نهائية ({STATUS_LABELS[router.status]}). لا يمكن تغيير حالته التشغيلية أو إعادته للخدمة بموجب اشتراطات دورة الحياة المعتمدة.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-lg border px-5 text-sm font-medium hover:bg-muted"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Target Status Selection */}
            <div>
              <label htmlFor="target-status" className={LABEL_CLASS}>
                الحالة الجديدة المستهدفة *
              </label>
              <select
                id="target-status"
                required
                value={targetStatus}
                onChange={(e) => {
                  const val = e.target.value as RouterStatus;
                  setTargetStatus(val);
                  setErrors((prev) => ({ ...prev, status: undefined }));
                }}
                className={INPUT_CLASS}
              >
                <option value="">اختر الحالة التالية المسموحة...</option>
                {allowedTransitions.map((status) => {
                  const isCustomerGate = status === "INSTALLED_AT_CUSTOMER";
                  return (
                    <option
                      key={status}
                      value={status}
                      disabled={isCustomerGate}
                    >
                      {STATUS_LABELS[status] ?? status}
                      {isCustomerGate ? " — (مؤجل لمرحلة M3a - التذاكر)" : ""}
                    </option>
                  );
                })}
              </select>
              {errors.status && (
                <p className="mt-1 text-xs text-red-600">{errors.status}</p>
              )}
            </div>

            {/* Special Prompt for ASSIGNED_TO_TECHNICIAN */}
            {targetStatus === "ASSIGNED_TO_TECHNICIAN" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <UserRoundPlus className="h-4 w-4 text-blue-600" />
                  صرف وتخصيص الراوتر لفني
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  يتطلب تسليم الجهاز لفني توثيق استلام العهدة وتحديد الفني المستلم بدقة. يرجى استخدام شاشة التخصيص المخصصة.
                </p>
                {onOpenAssign && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAssign();
                    }}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <UserRoundPlus className="h-3.5 w-3.5" />
                    الانتقال لشاشة صرف وتخصيص الفني
                  </button>
                )}
              </div>
            )}

            {/* Destination Warehouse (When returning or making available) */}
            {needsWarehouse && (
              <div>
                <label htmlFor="target-warehouse" className={LABEL_CLASS}>
                  المخزن المستلم للراوتر *
                </label>
                <div className="relative">
                  <select
                    id="target-warehouse"
                    required
                    value={targetWarehouseId}
                    onChange={(e) => {
                      setTargetWarehouseId(e.target.value);
                      setErrors((prev) => ({ ...prev, targetWarehouseId: undefined }));
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="">اختر المخزن المستلم...</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.targetWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.targetWarehouseId}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  المخزن الفعلي الذي سيتم إرجاع الجهاز إليه وتحديث رصيده وعهدته.
                </p>
              </div>
            )}

            {/* Operational Reason (Mandatory >= 3 chars) */}
            <div>
              <label htmlFor="transition-reason" className={LABEL_CLASS}>
                سبب الانتقال التشغيلي (مطلوب للتدقيق الرقابي) *
              </label>
              <textarea
                id="transition-reason"
                required
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: undefined }));
                }}
                placeholder="أدخل سبب الانتقال (مثال: فحص فني بعد الإرجاع، تلف أثناء النقل، تخريد نهائي...)"
                className="w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-teal-500"
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason}</p>
              )}
            </div>

            {/* Optional Notes */}
            <div>
              <label htmlFor="transition-notes" className={LABEL_CLASS}>
                ملاحظات إضافية
              </label>
              <input
                id="transition-notes"
                type="text"
                maxLength={250}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات توثيقية اختيارية..."
                className={INPUT_CLASS}
              />
            </div>

            {/* Server Error Alert */}
            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  تعذر تغيير الحالة
                </div>
                <p className="mt-1">{submitError}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  !targetStatus ||
                  targetStatus === "ASSIGNED_TO_TECHNICIAN" ||
                  targetStatus === "INSTALLED_AT_CUSTOMER"
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {loading ? "جاري الحفظ..." : "تأكيد تغيير الحالة"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
