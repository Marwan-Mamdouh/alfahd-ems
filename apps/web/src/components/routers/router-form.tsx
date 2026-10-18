"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Router as RouterIcon, Save, X } from "lucide-react";

import type { RouterFormValues, RouterRow } from "./types";

interface WarehouseOption {
  id: string;
  name: string;
}

interface RouterFormProps {
  router?: RouterRow | null;
  warehouses: WarehouseOption[];
  existingSerialNumbers?: string[];
  onSubmit: (values: RouterFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";

function getInitialValues(router?: RouterRow | null): RouterFormValues {
  return {
    serialNumber: router?.serialNumber ?? "",
    brand: router?.brand ?? "",
    model: router?.model ?? "",
    warehouseId: router?.warehouseId ?? "",
  };
}

export function RouterForm({
  router,
  warehouses,
  existingSerialNumbers = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RouterFormProps) {
  const isEdit = Boolean(router);

  const [values, setValues] = useState<RouterFormValues>(() => getInitialValues(router));

  const [errors, setErrors] = useState<Partial<Record<keyof RouterFormValues, string>>>({});

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  useEffect(() => {
    setValues(getInitialValues(router));
    setErrors({});
    setSubmitError(null);
  }, [router]);

  function updateField(field: keyof RouterFormValues, value: string) {
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
    const nextErrors: Partial<Record<keyof RouterFormValues, string>> = {};

    const serialNumber = values.serialNumber.trim();

    if (!serialNumber) {
      nextErrors.serialNumber = "الرقم التسلسلي مطلوب.";
    } else if (serialNumber.length < 5) {
      nextErrors.serialNumber = "الرقم التسلسلي يجب أن يكون 5 أحرف على الأقل.";
    } else if (
      existingSerialNumbers.some(
        (serial) =>
          serial.trim().toLowerCase() === serialNumber.toLowerCase() &&
          serial.trim().toLowerCase() !== (router?.serialNumber ?? "").trim().toLowerCase()
      )
    ) {
      nextErrors.serialNumber = "الرقم التسلسلي مستخدم بالفعل.";
    }

    if (!values.brand.trim()) {
      nextErrors.brand = "اسم الشركة مطلوب.";
    }

    if (!values.model.trim()) {
      nextErrors.model = "الموديل مطلوب.";
    }

    if (
      !values.warehouseId ||
      !warehouses.some((warehouse) => warehouse.id === values.warehouseId)
    ) {
      nextErrors.warehouseId = "يرجى اختيار مخزن صحيح.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: RouterFormValues = {
      serialNumber: values.serialNumber.trim(),
      brand: values.brand.trim(),
      model: values.model.trim(),
      warehouseId: values.warehouseId,
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);

      await onSubmit(cleanedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ بيانات الراوتر.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <RouterIcon className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold">
            {isEdit ? "تعديل بيانات الراوتر" : "إضافة راوتر جديد"}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            أدخل بيانات الجهاز ورقمه التسلسلي والمخزن التابع له.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="router-serial" className={LABEL_CLASS}>
            الرقم التسلسلي (Serial Number) *
          </label>

          <input
            id="router-serial"
            type="text"
            required
            minLength={5}
            maxLength={100}
            value={values.serialNumber}
            onChange={(event) => updateField("serialNumber", event.target.value)}
            placeholder="مثال: TPL-2026-00001"
            className={INPUT_CLASS}
            dir="ltr"
            autoComplete="off"
            aria-invalid={Boolean(errors.serialNumber)}
          />

          {errors.serialNumber && (
            <p className="mt-1 text-xs text-red-600">{errors.serialNumber}</p>
          )}
        </div>

        <div>
          <label htmlFor="router-brand" className={LABEL_CLASS}>
            الشركة المصنعة *
          </label>

          <input
            id="router-brand"
            type="text"
            required
            maxLength={100}
            value={values.brand}
            onChange={(event) => updateField("brand", event.target.value)}
            placeholder="مثال: TP-Link"
            className={INPUT_CLASS}
          />

          {errors.brand && <p className="mt-1 text-xs text-red-600">{errors.brand}</p>}
        </div>

        <div>
          <label htmlFor="router-model" className={LABEL_CLASS}>
            الموديل *
          </label>

          <input
            id="router-model"
            type="text"
            required
            maxLength={100}
            value={values.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="مثال: Archer C6"
            className={INPUT_CLASS}
          />

          {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="router-warehouse" className={LABEL_CLASS}>
            المخزن *
          </label>

          <select
            id="router-warehouse"
            required
            value={values.warehouseId}
            onChange={(event) => updateField("warehouseId", event.target.value)}
            className={INPUT_CLASS}
            aria-invalid={Boolean(errors.warehouseId)}
          >
            <option value="">اختر المخزن</option>

            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>

          {errors.warehouseId && <p className="mt-1 text-xs text-red-600">{errors.warehouseId}</p>}
        </div>
      </div>

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
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}

          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الراوتر"}
        </button>
      </div>
    </form>
  );
}