"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, Loader2, Save, X } from "lucide-react";

import type { InventoryMovementFormValues, InventoryMovementType } from "./types";

interface SelectOption {
  id: string;
  name: string;
}

interface InventoryMovementFormProps {
  items: SelectOption[];
  warehouses: SelectOption[];
  technicians: SelectOption[];
  onSubmit: (values: InventoryMovementFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const MOVEMENT_TYPES = [
  {
    value: "INBOUND" as const,
    label: "وارد",
    description: "استلام أصناف من المورد",
    icon: ArrowDownToLine,
  },
  {
    value: "OUTBOUND" as const,
    label: "صادر",
    description: "صرف أصناف إلى فني",
    icon: ArrowUpFromLine,
  },
  {
    value: "RETURN" as const,
    label: "مرتجع",
    description: "استلام أصناف مرتجعة من فني",
    icon: RotateCcw,
  },
];

const EMPTY_VALUES: InventoryMovementFormValues = {
  itemId: "",
  warehouseId: "",
  type: "INBOUND",
  quantity: "",
  technicianId: "",
  supplierName: "",
  notes: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

export function InventoryMovementForm({
  items,
  warehouses,
  technicians,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryMovementFormProps) {
  const [values, setValues] = useState<InventoryMovementFormValues>({
    ...EMPTY_VALUES,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof InventoryMovementFormValues, string>>>(
    {}
  );

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  function updateField(field: keyof InventoryMovementFormValues, value: string) {
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

  function changeType(type: InventoryMovementType) {
    setValues((previous) => ({
      ...previous,
      type,
      technicianId: "",
      supplierName: "",
    }));

    setErrors({});
    setSubmitError(null);
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof InventoryMovementFormValues, string>> = {};

    if (!values.itemId || !items.some((item) => item.id === values.itemId)) {
      nextErrors.itemId = "يرجى اختيار صنف صحيح.";
    }

    if (
      !values.warehouseId ||
      !warehouses.some((warehouse) => warehouse.id === values.warehouseId)
    ) {
      nextErrors.warehouseId = "يرجى اختيار مخزن صحيح.";
    }

    const quantity = Number(values.quantity);

    if (!values.quantity.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) {
      nextErrors.quantity = "الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.";
    }

    if (values.type === "INBOUND") {
      if (!values.supplierName.trim()) {
        nextErrors.supplierName = "اسم المورد مطلوب عند تسجيل الوارد.";
      }
    } else {
      if (
        !values.technicianId ||
        !technicians.some((technician) => technician.id === values.technicianId)
      ) {
        nextErrors.technicianId = "يرجى اختيار الفني.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: InventoryMovementFormValues = {
      ...values,
      supplierName: values.type === "INBOUND" ? values.supplierName.trim() : "",
      technicianId: values.type === "INBOUND" ? "" : values.technicianId,
      notes: values.notes.trim(),
      quantity: String(Number(values.quantity)),
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);

      await onSubmit(cleanedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "حدث خطأ أثناء تسجيل حركة المخزون.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">تسجيل حركة مخزون</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر نوع الحركة وأدخل بيانات الصنف والكمية.
        </p>
      </div>

      {/* Movement Type */}
      <div>
        <p className="mb-3 text-sm font-medium">نوع الحركة *</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MOVEMENT_TYPES.map((movement) => {
            const Icon = movement.icon;
            const isSelected = values.type === movement.value;

            return (
              <button
                key={movement.value}
                type="button"
                disabled={loading}
                onClick={() => changeType(movement.value)}
                aria-pressed={isSelected}
                className={`rounded-xl border p-4 text-right transition-colors ${
                  isSelected
                    ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <Icon className="mb-3 h-5 w-5" />
                <p className="font-semibold">{movement.label}</p>
                <p className="mt-1 text-xs opacity-75">{movement.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Fields */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="movement-item" className="mb-2 block text-sm font-medium">
            الصنف *
          </label>
          <select
            id="movement-item"
            required
            value={values.itemId}
            onChange={(e) => updateField("itemId", e.target.value)}
            className={fieldClass}
          >
            <option value="">اختر الصنف</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.itemId && <p className="mt-1 text-xs text-red-600">{errors.itemId}</p>}
        </div>

        <div>
          <label htmlFor="movement-warehouse" className="mb-2 block text-sm font-medium">
            المخزن *
          </label>
          <select
            id="movement-warehouse"
            required
            value={values.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
            className={fieldClass}
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

        <div>
          <label htmlFor="movement-quantity" className="mb-2 block text-sm font-medium">
            الكمية *
          </label>
          <input
            id="movement-quantity"
            type="number"
            required
            min={1}
            step={1}
            value={values.quantity}
            onChange={(e) => updateField("quantity", e.target.value)}
            placeholder="أدخل الكمية"
            className={fieldClass}
            dir="ltr"
          />
          {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
        </div>

        {values.type === "INBOUND" ? (
          <div>
            <label htmlFor="movement-supplier" className="mb-2 block text-sm font-medium">
              اسم المورد *
            </label>
            <input
              id="movement-supplier"
              type="text"
              required
              maxLength={150}
              value={values.supplierName}
              onChange={(e) => updateField("supplierName", e.target.value)}
              placeholder="اسم المورد"
              className={fieldClass}
            />
            {errors.supplierName && (
              <p className="mt-1 text-xs text-red-600">{errors.supplierName}</p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="movement-technician" className="mb-2 block text-sm font-medium">
              الفني *
            </label>
            <select
              id="movement-technician"
              required
              value={values.technicianId}
              onChange={(e) => updateField("technicianId", e.target.value)}
              className={fieldClass}
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
        )}

        <div className="md:col-span-2">
          <label htmlFor="movement-notes" className="mb-2 block text-sm font-medium">
            ملاحظات
          </label>
          <textarea
            id="movement-notes"
            rows={3}
            maxLength={1000}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="ملاحظات إضافية عن الحركة..."
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {submitError}
        </p>
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
          {loading ? "جاري التسجيل..." : "تسجيل الحركة"}
        </button>
      </div>
    </form>
  );
}
