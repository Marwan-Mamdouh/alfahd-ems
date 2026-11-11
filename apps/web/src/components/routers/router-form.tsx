"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  Loader2,
  Save,
  X,
} from "lucide-react";
import type { RouterPhysicalCondition } from "@alfahd/types";

import type { RouterRegistrationFormValues } from "./types";

interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  model?: string;
  isSerialized?: boolean;
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface RouterFormProps {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  onSubmit: (values: RouterRegistrationFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";

const INITIAL_VALUES: RouterRegistrationFormValues = {
  serialNumber: "",
  productId: "",
  warehouseId: "",
  physicalCondition: "SERVICEABLE",
  isNewReceipt: true,
  notes: "",
};

export function RouterForm({
  products,
  warehouses,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RouterFormProps) {
  const [values, setValues] = useState<RouterRegistrationFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof RouterRegistrationFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  // Filter products to serialized only (or all if not flagged false)
  const serializedProducts = products.filter((p) => p.isSerialized !== false);

  function updateField<K extends keyof RouterRegistrationFormValues>(
    field: K,
    value: RouterRegistrationFormValues[K]
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
    const nextErrors: Partial<Record<keyof RouterRegistrationFormValues, string>> = {};

    const serialNumber = values.serialNumber.trim().toUpperCase();
    if (!serialNumber) {
      nextErrors.serialNumber = "الرقم التسلسلي (Serial Number) مطلوب.";
    } else if (serialNumber.length < 3) {
      nextErrors.serialNumber = "الرقم التسلسلي يجب أن يتكون من 3 أحرف على الأقل.";
    }

    if (!values.productId || !serializedProducts.some((p) => p.id === values.productId)) {
      nextErrors.productId = "يرجى اختيار موديل الراوتر من الكتالوج.";
    }

    if (!values.warehouseId || !warehouses.some((w) => w.id === values.warehouseId)) {
      nextErrors.warehouseId = "يرجى اختيار المخزن الفعلي.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const payload: RouterRegistrationFormValues = {
      ...values,
      serialNumber: values.serialNumber.trim().toUpperCase(),
      notes: values.notes.trim(),
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);
      await onSubmit(payload);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء تسجيل الراوتر."
      );
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">تسجيل جهاز راوتر جديد</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل بيانات السيريال والمخزن واختر نمط الاستلام (شحنة جديدة أو من الرصيد الحالي).
        </p>
      </div>

      {/* Onboarding Mode Selection (isNewReceipt) */}
      <div>
        <p className="mb-3 text-sm font-medium">نمط تسجيل الجهاز في المخزن *</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* New Receipt Mode */}
          <button
            type="button"
            disabled={loading}
            onClick={() => updateField("isNewReceipt", true)}
            aria-pressed={values.isNewReceipt}
            className={`rounded-xl border p-4 text-right transition-colors ${
              values.isNewReceipt
                ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200 ring-2 ring-teal-500/20"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">استلام شحنة جديدة من المورد</p>
                <p className="mt-1 text-xs opacity-80">
                  زيادة رصيد المخزن تلقائياً (+1 وارد مورد) وفتح عهدة المخزن.
                </p>
              </div>
            </div>
          </button>

          {/* Existing Stock Mode */}
          <button
            type="button"
            disabled={loading}
            onClick={() => updateField("isNewReceipt", false)}
            aria-pressed={!values.isNewReceipt}
            className={`rounded-xl border p-4 text-right transition-colors ${
              !values.isNewReceipt
                ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200 ring-2 ring-teal-500/20"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">تسجيل من رصيد المخزن الحالي</p>
                <p className="mt-1 text-xs opacity-80">
                  حجز جهاز من الرصيد المسجل مسبقًا (+0 تغيير) مع فحص سعة المخزن المتاحة.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Basic Inputs */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Serial Number */}
        <div>
          <label htmlFor="router-serial" className={LABEL_CLASS}>
            الرقم التسلسلي (Serial Number) *
          </label>
          <input
            id="router-serial"
            type="text"
            required
            maxLength={100}
            value={values.serialNumber}
            onChange={(e) => updateField("serialNumber", e.target.value.toUpperCase())}
            placeholder="مثال: TPL-2026-88491"
            className={`${INPUT_CLASS} font-mono`}
            dir="ltr"
          />
          {errors.serialNumber && (
            <p className="mt-1 text-xs text-red-600">{errors.serialNumber}</p>
          )}
        </div>

        {/* Product Model */}
        <div>
          <label htmlFor="router-product" className={LABEL_CLASS}>
            نوع وموديل الراوتر (كتالوج المنتجات) *
          </label>
          <select
            id="router-product"
            required
            value={values.productId}
            onChange={(e) => updateField("productId", e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">اختر الموديل من الكتالوج</option>
            {serializedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} {product.model ? `(${product.model})` : ""} {product.sku ? `— ${product.sku}` : ""}
              </option>
            ))}
          </select>
          {errors.productId && (
            <p className="mt-1 text-xs text-red-600">{errors.productId}</p>
          )}
        </div>

        {/* Target Warehouse */}
        <div>
          <label htmlFor="router-warehouse" className={LABEL_CLASS}>
            المخزن المستلم *
          </label>
          <select
            id="router-warehouse"
            required
            value={values.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">اختر المخزن</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          {errors.warehouseId && (
            <p className="mt-1 text-xs text-red-600">{errors.warehouseId}</p>
          )}
        </div>

        {/* Physical Condition */}
        <div>
          <label htmlFor="router-condition" className={LABEL_CLASS}>
            الحالة الفيزيائية الابتدائية *
          </label>
          <select
            id="router-condition"
            required
            value={values.physicalCondition}
            onChange={(e) =>
              updateField("physicalCondition", e.target.value as RouterPhysicalCondition)
            }
            className={INPUT_CLASS}
          >
            <option value="SERVICEABLE">صالح للاستخدام (سليم - جاهز للتشغيل)</option>
            <option value="DAMAGED">تالف / معيب (تسجيل وحدة متضررة)</option>
            <option value="UNDER_REPAIR">قيد الصيانة / الإصلاح</option>
          </select>
          {!values.isNewReceipt && values.physicalCondition === "DAMAGED" && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              ملاحظة: تسجيل جهاز تالف من الرصيد الحالي سيقوم بخصم 1 من رصيد المخزن عبر تسوية جردية رقابية.
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="router-notes" className={LABEL_CLASS}>
            ملاحظات إضافية
          </label>
          <textarea
            id="router-notes"
            rows={3}
            maxLength={1000}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="أدخل أي تفاصيل عن الشحنة، المورد، أو الفحص المبدئي للجهاز..."
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Server Rejection Alert Banner */}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            تعذر تسجيل الراوتر
          </div>
          <p className="mt-1 text-xs leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Buttons */}
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
          {loading ? "جاري التسجيل..." : "تسجيل الراوتر"}
        </button>
      </div>
    </form>
  );
}
