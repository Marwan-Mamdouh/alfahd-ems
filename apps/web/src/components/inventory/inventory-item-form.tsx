"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, PackagePlus, Save, X } from "lucide-react";

import type { InventoryItemRow, InventoryItemFormValues } from "./types";

interface InventoryItemFormProps {
  item?: InventoryItemRow | null;
  onSubmit: (values: InventoryItemFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const EMPTY_VALUES: InventoryItemFormValues = {
  name: "",
  model: "",
  category: "",
  description: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

const labelClass = "mb-2 block text-sm font-medium text-foreground";

function getInitialValues(item?: InventoryItemRow | null): InventoryItemFormValues {
  if (!item) return { ...EMPTY_VALUES };

  return {
    name: item.name,
    model: item.model,
    category: item.category,
    description: item.description ?? "",
  };
}

export function InventoryItemForm({
  item,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryItemFormProps) {
  const isEdit = Boolean(item);

  const [values, setValues] = useState<InventoryItemFormValues>(() => getInitialValues(item));

  const [errors, setErrors] = useState<Partial<Record<keyof InventoryItemFormValues, string>>>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  useEffect(() => {
    setValues(getInitialValues(item));
    setErrors({});
    setSubmitError(null);
  }, [item]);

  function updateField(field: keyof InventoryItemFormValues, value: string) {
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
    const nextErrors: Partial<Record<keyof InventoryItemFormValues, string>> = {};

    if (!values.name.trim()) {
      nextErrors.name = "اسم الصنف مطلوب.";
    } else if (values.name.trim().length < 2) {
      nextErrors.name = "اسم الصنف يجب أن يحتوي على حرفين على الأقل.";
    }

    if (!values.model.trim()) {
      nextErrors.model = "موديل الصنف مطلوب.";
    }

    if (!values.category.trim()) {
      nextErrors.category = "تصنيف الصنف مطلوب.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: InventoryItemFormValues = {
      name: values.name.trim(),
      model: values.model.trim(),
      category: values.category.trim(),
      description: values.description.trim(),
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);

      await onSubmit(cleanedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ بيانات الصنف.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <PackagePlus className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isEdit ? "تعديل بيانات الصنف" : "إضافة صنف جديد"}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "قم بتحديث بيانات الصنف داخل الكتالوج."
              : "أدخل بيانات الصنف لإضافته إلى كتالوج المخزون."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="inventory-item-name" className={labelClass}>
            اسم الصنف *
          </label>

          <input
            id="inventory-item-name"
            type="text"
            required
            minLength={2}
            maxLength={150}
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="مثال: كابل إنترنت"
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
          />

          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="inventory-item-model" className={labelClass}>
            الموديل *
          </label>

          <input
            id="inventory-item-model"
            type="text"
            required
            maxLength={100}
            value={values.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="مثال: CAT6"
            className={inputClass}
          />

          {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="inventory-item-category" className={labelClass}>
            التصنيف *
          </label>

          <input
            id="inventory-item-category"
            type="text"
            required
            maxLength={100}
            value={values.category}
            onChange={(event) => updateField("category", event.target.value)}
            placeholder="مثال: كابلات أو راوترات"
            className={inputClass}
          />

          {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="inventory-item-description" className={labelClass}>
            وصف الصنف
          </label>

          <textarea
            id="inventory-item-description"
            rows={4}
            maxLength={1000}
            value={values.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="اكتب وصفًا مختصرًا للصنف..."
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
          />
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
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}

          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الصنف"}
        </button>
      </div>
    </form>
  );
}
