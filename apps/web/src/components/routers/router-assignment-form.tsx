"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Router as RouterIcon, Save, UserRoundPlus, X } from "lucide-react";

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

  const [errors, setErrors] = useState<Partial<Record<keyof RouterAssignmentFormValues, string>>>(
    {}
  );

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  const availableRouters = useMemo(
    () => routers.filter((router) => router.status === "IN_STOCK"),
    [routers]
  );

  const selectedRouter = useMemo(
    () => routers.find((router) => router.id === values.routerId) ?? null,
    [routers, values.routerId]
  );

  const canAssignSelectedRouter = selectedRouter?.status === "IN_STOCK";

  useEffect(() => {
    setValues({
      routerId: initialRouterId,
      technicianId: "",
      notes: "",
    });
    setErrors({});
    setSubmitError(null);
  }, [initialRouterId]);

  function updateField(field: keyof RouterAssignmentFormValues, value: string) {
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

    if (!selectedRouter) {
      nextErrors.routerId = "يرجى اختيار راوتر صحيح.";
    } else if (!canAssignSelectedRouter) {
      nextErrors.routerId = "لا يمكن تخصيص الراوتر إلا إذا كان موجودًا بالمخزن.";
    }

    if (
      !values.technicianId ||
      !technicians.some((technician) => technician.id === values.technicianId)
    ) {
      nextErrors.technicianId = "يرجى اختيار فني صحيح.";
    }

    if (values.notes.length > 1000) {
      nextErrors.notes = "الملاحظات لا يجب أن تتجاوز 1000 حرف.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: RouterAssignmentFormValues = {
      routerId: values.routerId,
      technicianId: values.technicianId,
      notes: values.notes.trim(),
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);

      await onSubmit(cleanedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "حدث خطأ أثناء تخصيص الراوتر.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <UserRoundPlus className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold">تخصيص راوتر لفني</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            اختر الراوتر والفني المسؤول عنه. الراوترات المتاحة للتخصيص هي الموجودة بالمخزن فقط.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Router */}
        <div>
          <label htmlFor="assignment-router" className={LABEL_CLASS}>
            الراوتر *
          </label>

          <select
            id="assignment-router"
            required
            value={values.routerId}
            disabled={loading}
            onChange={(event) => updateField("routerId", event.target.value)}
            aria-invalid={Boolean(errors.routerId)}
            className={INPUT_CLASS}
          >
            <option value="">اختر الراوتر</option>

            {availableRouters.map((router) => (
              <option key={router.id} value={router.id}>
                {router.serialNumber} — {router.brand} {router.model}
              </option>
            ))}

            {selectedRouter && !canAssignSelectedRouter && (
              <option value={selectedRouter.id} disabled>
                {selectedRouter.serialNumber} — غير متاح للتخصيص
              </option>
            )}
          </select>

          {errors.routerId && <p className="mt-1 text-xs text-red-600">{errors.routerId}</p>}
        </div>

        {/* Technician */}
        <div>
          <label htmlFor="assignment-technician" className={LABEL_CLASS}>
            الفني *
          </label>

          <select
            id="assignment-technician"
            required
            value={values.technicianId}
            disabled={loading}
            onChange={(event) => updateField("technicianId", event.target.value)}
            aria-invalid={Boolean(errors.technicianId)}
            className={INPUT_CLASS}
          >
            <option value="">اختر الفني</option>

            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>

          {errors.technicianId && (
            <p className="mt-1 text-xs text-red-600">{errors.technicianId}</p>
          )}
        </div>

        {/* Selected Router Summary */}
        {selectedRouter && (
          <div className="md:col-span-2">
            <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
              <RouterIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />

              <div className="space-y-1 text-sm">
                <p className="font-semibold">بيانات الراوتر المحدد</p>

                <p>
                  الرقم التسلسلي:{" "}
                  <span className="font-mono" dir="ltr">
                    {selectedRouter.serialNumber}
                  </span>
                </p>

                <p>
                  الشركة والموديل: {selectedRouter.brand} — {selectedRouter.model}
                </p>

                <p>المخزن: {selectedRouter.warehouseName ?? "غير محدد"}</p>

                {!canAssignSelectedRouter && (
                  <p className="font-medium text-red-600">هذا الراوتر غير متاح للتخصيص حاليًا.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="assignment-notes" className={LABEL_CLASS}>
            ملاحظات
          </label>

          <textarea
            id="assignment-notes"
            rows={4}
            maxLength={1000}
            value={values.notes}
            disabled={loading}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="اكتب ملاحظات عن عملية التخصيص..."
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:border-teal-500"
          />

          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes}</p>}
        </div>
      </div>

      {availableRouters.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          لا توجد أجهزة راوتر متاحة للتخصيص حاليًا.
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {submitError}
        </div>
      )}

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
          disabled={loading || availableRouters.length === 0 || !canAssignSelectedRouter}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}

          {loading ? "جاري التخصيص..." : "تأكيد التخصيص"}
        </button>
      </div>
    </form>
  );
}
