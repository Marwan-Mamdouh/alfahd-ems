"use client";

import { useState, useMemo, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  Wrench,
  X,
} from "lucide-react";
import type { RouterPhysicalCondition } from "@alfahd/types";

import type { RouterRow, RouterConditionFormValues } from "./types";

interface WarehouseOption {
  id: string;
  name: string;
}

interface RouterConditionDialogProps {
  router: RouterRow;
  warehouses: WarehouseOption[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RouterConditionFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

const CONDITION_LABELS: Record<RouterPhysicalCondition, string> = {
  SERVICEABLE: "سليم (صالح للاستخدام - جاهز للتشغيل)",
  DAMAGED: "تالف / معيب (غير صالح للاستخدام)",
  UNDER_REPAIR: "قيد الصيانة / الإصلاح الفني",
};

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";
const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";

export function RouterConditionDialog({
  router,
  warehouses,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: RouterConditionDialogProps) {
  const [condition, setCondition] = useState<RouterPhysicalCondition>(
    router.physicalCondition
  );
  const [locationType, setLocationType] = useState<"warehouse" | "external">(
    router.externalLocation ? "external" : "warehouse"
  );
  const [warehouseId, setWarehouseId] = useState<string>(
    router.warehouseId ?? ""
  );
  const [externalLocation, setExternalLocation] = useState<string>(
    router.externalLocation ?? ""
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    warehouseId?: string;
    externalLocation?: string;
    reason?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;
  const isTerminal = router.status === "LOST" || router.status === "DECOMMISSIONED";

  // Calculate operational impact based on M2b contract §5.1:
  // Usable stock exists iff status === 'AVAILABLE' && condition === 'SERVICEABLE' && in warehouse.
  const impactMessage = useMemo(() => {
    if (router.status !== "AVAILABLE") {
      return null;
    }

    const wasUsable = router.physicalCondition === "SERVICEABLE" && Boolean(router.warehouseId);
    const willBeUsable =
      condition === "SERVICEABLE" &&
      locationType === "warehouse" &&
      Boolean(warehouseId);

    if (wasUsable && !willBeUsable) {
      return "تنبيه رقابي: سيتم خصم وحدة من الرصيد الصالح للاستخدام بالمخزن (-1 تسوية جردية) وإغلاق عهدة المخزن الحالية.";
    }
    if (!wasUsable && willBeUsable) {
      return "تأثير إيجابي: سيتم إضافة وحدة إلى رصيد المخزن الصالح للاستخدام (+1 تسوية جردية) وفتح عهدة المخزن المستلم.";
    }
    if (wasUsable && willBeUsable && router.warehouseId !== warehouseId) {
      return "نقل عهدة: سيتم نقل وحدة من المخزن السابق إلى المخزن الجديد وتحديث عهدة المخزن تلقائياً.";
    }
    return null;
  }, [router, condition, locationType, warehouseId]);

  function validate(): boolean {
    const nextErrors: typeof errors = {};

    if (locationType === "warehouse" && !warehouseId) {
      nextErrors.warehouseId = "يرجى اختيار المخزن الفعلي للراوتر.";
    }

    if (locationType === "external" && !externalLocation.trim()) {
      nextErrors.externalLocation = "يرجى تحديد وصف الموقع الخارجي (مثل: ورشة الصيانة المركزية).";
    }

    if (!reason.trim() || reason.trim().length < 3) {
      nextErrors.reason = "سبب التعديل مطلوب ولا يقل عن 3 أحرف لتوثيق السجل الرقابي.";
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
        physicalCondition: condition,
        locationType,
        warehouseId: locationType === "warehouse" ? warehouseId : undefined,
        externalLocation:
          locationType === "external" ? externalLocation.trim() : undefined,
        reason: reason.trim(),
      });

      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء تحديث الحالة والموقع."
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
      aria-labelledby="condition-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 id="condition-dialog-title" className="text-lg font-bold text-foreground">
                تحديث الحالة الفيزيائية والموقع
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

        {/* Current State Info */}
        <div className="my-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-xs">
          <div>
            <span className="text-muted-foreground">الحالة الفيزيائية الحالية:</span>
            <p className="mt-1 font-semibold text-foreground">
              {CONDITION_LABELS[router.physicalCondition] ?? router.physicalCondition}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">الموقع الفعلي الحالي:</span>
            <p className="mt-1 font-semibold text-foreground">
              {router.warehouseName || router.externalLocation || "غير محدد"}
            </p>
          </div>
        </div>

        {/* Terminal Check */}
        {isTerminal ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold text-sm">حالة نهائية غير قابلة للتعديل</p>
                <p className="mt-1 text-xs leading-relaxed">
                  لا يمكن تعديل الحالة الفيزيائية أو موقع جهاز في حالة نهائية (مفقود أو مكهن خارج الخدمة).
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
            {/* Condition Selection */}
            <div>
              <label htmlFor="physical-condition" className={LABEL_CLASS}>
                الحالة الفيزيائية الجديدة *
              </label>
              <select
                id="physical-condition"
                required
                value={condition}
                onChange={(e) => setCondition(e.target.value as RouterPhysicalCondition)}
                className={INPUT_CLASS}
              >
                <option value="SERVICEABLE">سليم (صالح للاستخدام - جاهز للتشغيل)</option>
                <option value="DAMAGED">تالف / معيب (غير صالح للاستخدام)</option>
                <option value="UNDER_REPAIR">قيد الصيانة / الإصلاح الفني</option>
              </select>
            </div>

            {/* Location Type Selector */}
            <div>
              <p className="mb-2 block text-sm font-medium text-foreground">
                الموقع الفيزيائي للجهاز *
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setLocationType("warehouse")}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                    locationType === "warehouse"
                      ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200 ring-2 ring-teal-500/20"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  مخزن داخلي
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setLocationType("external")}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                    locationType === "external"
                      ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200 ring-2 ring-teal-500/20"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  موقع صيانة خارجي
                </button>
              </div>
            </div>

            {/* Internal Warehouse Dropdown */}
            {locationType === "warehouse" ? (
              <div>
                <label htmlFor="condition-warehouse" className={LABEL_CLASS}>
                  المخزن التابع له الجهاز *
                </label>
                <select
                  id="condition-warehouse"
                  required
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    setErrors((prev) => ({ ...prev, warehouseId: undefined }));
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">اختر المخزن...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {errors.warehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.warehouseId}</p>
                )}
              </div>
            ) : (
              /* External Location Input */
              <div>
                <label htmlFor="external-location" className={LABEL_CLASS}>
                  وصف الموقع الخارجي *
                </label>
                <input
                  id="external-location"
                  type="text"
                  required
                  maxLength={255}
                  value={externalLocation}
                  onChange={(e) => {
                    setExternalLocation(e.target.value);
                    setErrors((prev) => ({ ...prev, externalLocation: undefined }));
                  }}
                  placeholder="مثال: ورشة الصيانة المركزية - المعادي، وكيل الصيانة المعتمد..."
                  className={INPUT_CLASS}
                />
                {errors.externalLocation && (
                  <p className="mt-1 text-xs text-red-600">{errors.externalLocation}</p>
                )}
              </div>
            )}

            {/* Impact Notice */}
            {impactMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="leading-relaxed">{impactMessage}</p>
              </div>
            )}

            {/* Operational Reason (Mandatory >= 3 chars) */}
            <div>
              <label htmlFor="condition-reason" className={LABEL_CLASS}>
                سبب التعديل أو تقرير الفحص (مطلوب للتدقيق الرقابي) *
              </label>
              <textarea
                id="condition-reason"
                required
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: undefined }));
                }}
                placeholder="أدخل سبب التعديل (مثال: كسر هوائي الجهاز، فحص بعد الصيانة الدورية، نقل للصيانة الخارجية...)"
                className="w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-teal-500"
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason}</p>
              )}
            </div>

            {/* Server Error Alert */}
            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  تعذر تحديث الحالة أو الموقع
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
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {loading ? "جاري الحفظ..." : "حفظ التعديل"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

