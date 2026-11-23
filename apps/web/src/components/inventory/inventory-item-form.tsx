"use client";

import { useState, type FormEvent } from "react";
import { Loader2, PackagePlus, Save, X } from "lucide-react";

import type { InventoryItemRow, InventoryItemFormValues, ProductRow } from "./types";

export interface InventoryItemFormProps {
  item?: InventoryItemRow | ProductRow | null;
  onSubmit: (values: InventoryItemFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  serverError?: string | null;
  fieldErrors?: Partial<Record<keyof InventoryItemFormValues, string>>;
}

const EMPTY_VALUES: InventoryItemFormValues = {
  name: "",
  sku: "",
  model: "",
  category: "",
  description: "",
  lowStockThreshold: "10",
};

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

const labelClass = "mb-2 block text-sm font-medium text-foreground";

function getInitialValues(item?: InventoryItemRow | ProductRow | null): InventoryItemFormValues {
  if (!item) return { ...EMPTY_VALUES };

  return {
    name: item.name,
    sku: item.sku ?? "",
    model: item.model,
    category: item.category,
    description: item.description ?? "",
    lowStockThreshold: String(item.lowStockThreshold ?? 10),
  };
}

export function InventoryItemForm({
  item,
  onSubmit,
  onCancel,
  isSubmitting = false,
  serverError = null,
  fieldErrors = {},
}: InventoryItemFormProps) {
  const isEdit = Boolean(item);

  const [values, setValues] = useState<InventoryItemFormValues>(() => getInitialValues(item));
  const [clientErrors, setClientErrors] = useState<Partial<Record<keyof InventoryItemFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  function updateField(field: keyof InventoryItemFormValues, value: string) {
    setValues((previous) => ({
      ...previous,
      [field]: field === "sku" ? value.toUpperCase() : value,
    }));

    setClientErrors((previous) => ({
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
    } else if (values.name.trim().length > 255) {
      nextErrors.name = "اسم الصنف يجب ألا يتجاوز 255 حرفًا.";
    }

    if (!values.sku.trim()) {
      nextErrors.sku = "رمز الصنف (SKU) مطلوب.";
    } else if (values.sku.trim().length > 100) {
      nextErrors.sku = "رمز الصنف يجب ألا يتجاوز 100 حرف.";
    }

    if (!values.model.trim()) {
      nextErrors.model = "موديل الصنف مطلوب.";
    } else if (values.model.trim().length > 255) {
      nextErrors.model = "موديل الصنف يجب ألا يتجاوز 255 حرفًا.";
    }

    if (!values.category.trim()) {
      nextErrors.category = "تصنيف الصنف مطلوب.";
    } else if (values.category.trim().length > 100) {
      nextErrors.category = "تصنيف الصنف يجب ألا يتجاوز 100 حرف.";
    }

    const threshold = Number(values.lowStockThreshold);
    if (!values.lowStockThreshold.trim()) {
      nextErrors.lowStockThreshold = "حد انخفاض المخزون مطلوب.";
    } else if (!Number.isInteger(threshold) || threshold < 0) {
      nextErrors.lowStockThreshold = "حد انخفاض المخزون يجب أن يكون رقمًا صحيحًا غير سالب.";
    }

    setClientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: InventoryItemFormValues = {
      name: values.name.trim(),
      sku: values.sku.trim().toUpperCase(),
      model: values.model.trim(),
      category: values.category.trim(),
      description: values.description.trim(),
      lowStockThreshold: String(Math.floor(Number(values.lowStockThreshold))),
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

  const errors = { ...fieldErrors, ...clientErrors };
  const activeError = serverError || submitError;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          {isEdit ? "تعديل بيانات الصنف" : "إضافة صنف جديد للكتالوج"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل بيانات الصنف الأساسية ومستوى إعادة الطلب بدقة.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="item-name" className={labelClass}>
            اسم الصنف *
          </label>
          <input
            id="item-name"
            type="text"
            required
            disabled={loading}
            maxLength={255}
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="مثال: راوتر ألياف بصرية، كابل إيثرنت CAT6"
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="item-sku" className={labelClass}>
            رمز الصنف (SKU) *
          </label>
          <input
            id="item-sku"
            type="text"
            required
            disabled={loading}
            maxLength={100}
            value={values.sku}
            onChange={(e) => updateField("sku", e.target.value)}
            placeholder="مثال: RTR-AX1800-V2"
            className={inputClass}
            dir="ltr"
            aria-invalid={Boolean(errors.sku)}
          />
          {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku}</p>}
        </div>

        <div>
          <label htmlFor="item-model" className={labelClass}>
            الموديل / الطراز *
          </label>
          <input
            id="item-model"
            type="text"
            required
            disabled={loading}
            maxLength={255}
            value={values.model}
            onChange={(e) => updateField("model", e.target.value)}
            placeholder="مثال: HG8245H5، Archer C6"
            className={inputClass}
            aria-invalid={Boolean(errors.model)}
          />
          {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model}</p>}
        </div>

        <div>
          <label htmlFor="item-category" className={labelClass}>
            التصنيف *
          </label>
          <input
            id="item-category"
            type="text"
            required
            disabled={loading}
            maxLength={100}
            value={values.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="مثال: أجهزة راوتر، كابلات، محولات، أدوات شبكة"
            className={inputClass}
            aria-invalid={Boolean(errors.category)}
          />
          {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
        </div>

        <div>
          <label htmlFor="item-threshold" className={labelClass}>
            حد انخفاض المخزون (تنبيه إعادة الطلب) *
          </label>
          <input
            id="item-threshold"
            type="number"
            required
            min={0}
            step={1}
            disabled={loading}
            value={values.lowStockThreshold}
            onChange={(e) => updateField("lowStockThreshold", e.target.value)}
            placeholder="10"
            className={inputClass}
            dir="ltr"
            aria-invalid={Boolean(errors.lowStockThreshold)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            الحد الأدنى للكمية الذي يُطلق عنده النظام تنبيه انخفاض المخزون (الافتراضي: 10 وحدات).
          </p>
          {errors.lowStockThreshold && (
            <p className="mt-1 text-xs text-red-600">{errors.lowStockThreshold}</p>
          )}
        </div>

        <div>
          <label htmlFor="item-description" className={labelClass}>
            الوصف والملاحظات (اختياري)
          </label>
          <input
            id="item-description"
            type="text"
            disabled={loading}
            value={values.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="مواصفات إضافية، تفاصيل التوريد أو التركيب"
            className={inputClass}
          />
        </div>
      </div>

      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {activeError}
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
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            <Save className="h-4 w-4" />
          ) : (
            <PackagePlus className="h-4 w-4" />
          )}
          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الصنف"}
        </button>
      </div>
    </form>
  );
}
