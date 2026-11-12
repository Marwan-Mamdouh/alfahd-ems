"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Router as RouterIcon,
  Save,
  X,
} from "lucide-react";

import type { RouterAssignmentFormValues, RouterRow } from "./types";

interface TechnicianOption {
  id: string;
  name: string;
}

interface RouterAssignmentFormProps {
  routers: RouterRow[];
  technicians: TechnicianOption[];
  initialRouterId?: string;
  onSubmit: (values: RouterAssignmentFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";

export function RouterAssignmentForm({
  routers,
  technicians,
  initialRouterId = "",
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RouterAssignmentFormProps) {
  const [values, setValues] = useState<RouterAssignmentFormValues>({
    routerId: initialRouterId,
    technicianId: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RouterAssignmentFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  // Domain rule: A router is assignable to a technician ONLY if AVAILABLE, SERVICEABLE, and in a warehouse.
  const assignableRouters = useMemo(
    () =>
      (routers ?? []).filter(
        (r) =>
          r.status === "AVAILABLE" &&
          r.physicalCondition === "SERVICEABLE" &&
          Boolean(r.warehouseId)
      ),
    [routers]
  );

  const selectedRouter = useMemo(
    () => routers.find((router) => router.id === values.routerId) ?? null,
    [routers, values.routerId]
  );

  function updateField<K extends keyof RouterAssignmentFormValues>(
    field: K,
    value: RouterAssignmentFormValues[K]
  ) {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setSubmitError(null);
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof RouterAssignmentFormValues, string>> = {};

    if (!values.routerId) {
      nextErrors.routerId = "يرجى اختيار جهاز الراوتر المراد صرفه وتخصيصه.";
    } else if (
      selectedRouter &&
      (selectedRouter.status !== "AVAILABLE" ||
        selectedRouter.physicalCondition !== "SERVICEABLE" ||
        !selectedRouter.warehouseId)
    ) {
      nextErrors.routerId = "الراوتر المختار غير متاح للصرف أو غير صالح للاستخدام بالمخزن.";
    }

    if (!values.technicianId || !technicians.some((tech) => tech.id === values.technicianId)) {
      nextErrors.technicianId = "يرجى اختيار الفني المستلم للعهدة.";
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
        routerId: values.routerId,
        technicianId: values.technicianId,
        notes: values.notes.trim(),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء تخصيص الراوتر."
      );
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">صرف وتخصيص راوتر لفني ميداني</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تسليم عهدة جهاز راوتر سليم ومتاح بالمخزن إلى فني معتمد (خصم رصيد المخزن وتسجيل حركة صادر).
        </p>
      </div>

      {/* Selected Router Preview Card */}
      {selectedRouter && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                <RouterIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono font-bold text-foreground" dir="ltr">
                  {selectedRouter.serialNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedRouter.productName} {selectedRouter.productModel ? `(${selectedRouter.productModel})` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                جاهز للصرف
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {selectedRouter.warehouseName ?? "المخزن"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Router Selection */}
        <div className="md:col-span-2">
          <label htmlFor="assign-router-id" className={LABEL_CLASS}>
            اختر جهاز الراوتر *
          </label>
          <select
            id="assign-router-id"
            required
            value={values.routerId}
            onChange={(e) => updateField("routerId", e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">
              {assignableRouters.length === 0
                ? "لا توجد أجهزة راوتر صالحة ومتاحة بالمخزن حاليًا"
                : "اختر راوتر متاح للصرف"}
            </option>
            {assignableRouters.map((router) => (
              <option key={router.id} value={router.id}>
                {router.serialNumber} — {router.productName} ({router.warehouseName})
              </option>
            ))}
          </select>
          {errors.routerId && <p className="mt-1 text-xs text-red-600">{errors.routerId}</p>}
        </div>

        {/* Technician Selection */}
        <div className="md:col-span-2">
          <label htmlFor="assign-technician-id" className={LABEL_CLASS}>
            الفني المستلم (المسؤول عن العهدة) *
          </label>
          <select
            id="assign-technician-id"
            required
            value={values.technicianId}
            onChange={(e) => updateField("technicianId", e.target.value)}
            className={INPUT_CLASS}
            disabled={technicians.length === 0}
          >
            <option value="" disabled={technicians.length === 0}>
              {technicians.length === 0 ? "لا يوجد فنيين نشطين مسجلين" : "اختر الفني الميداني"}
            </option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>
          {technicians.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              لا يمكن صرف الراوتر لعدم وجود فنيين نشطين مسجلين في النظام حالياً.
            </p>
          )}
          {errors.technicianId && (
            <p className="mt-1 text-xs text-red-600">{errors.technicianId}</p>
          )}
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="assign-notes" className={LABEL_CLASS}>
            ملاحظات الصرف وأمر العمل
          </label>
          <textarea
            id="assign-notes"
            rows={3}
            maxLength={1000}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="أدخل أي ملاحظات عن أمر التركيب أو سبب الصرف للفني..."
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Error Alert */}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            تعذر صرف الراوتر
          </div>
          <p className="mt-1 text-xs leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        {onCancel && (
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="inline-flex h-10 items-center gap-2 rounded-lg border px-5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            إلغاء
          </button>
        )}

        <button
          type="submit"
          disabled={loading || assignableRouters.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {loading ? "جاري التخصيص..." : "تأكيد الصرف والتسليم"}
        </button>
      </div>
    </form>
  );
}
