"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  ArrowLeftRight,
  SlidersHorizontal,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { Role } from "@alfahd/types";

import type { InventoryMovementFormValues, InventoryMovementType } from "./types";

export interface ItemSelectOption {
  id: string;
  name: string;
  isSerialized?: boolean;
}

export interface SelectOption {
  id: string;
  name: string;
}

interface InventoryMovementFormProps {
  items: ItemSelectOption[];
  warehouses: SelectOption[];
  technicians: SelectOption[];
  userRole?: Role | null;
  onSubmit: (values: InventoryMovementFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const ALL_MOVEMENT_TYPES = [
  {
    value: "INBOUND_SUPPLIER" as const,
    label: "وارد مورد",
    description: "استلام أصناف جديدة من المورد",
    icon: ArrowDownToLine,
    adminOnly: false,
  },
  {
    value: "OUTBOUND_TECHNICIAN" as const,
    label: "صرف لفني",
    description: "صرف أصناف إلى فني ميداني",
    icon: ArrowUpFromLine,
    adminOnly: false,
  },
  {
    value: "RETURN_TECHNICIAN" as const,
    label: "مرتجع فني",
    description: "استلام أصناف مرتجعة من فني",
    icon: RotateCcw,
    adminOnly: false,
  },
  {
    value: "TRANSFER_WAREHOUSE" as const,
    label: "تحويل مخزني",
    description: "نقل كميات بين مخزنين مختلفين",
    icon: ArrowLeftRight,
    adminOnly: false,
  },
  {
    value: "ADJUSTMENT" as const,
    label: "تسوية جردية",
    description: "تصحيح الرصيد بعد الجرد الفعلي",
    icon: SlidersHorizontal,
    adminOnly: true,
  },
];

const EMPTY_VALUES: InventoryMovementFormValues = {
  itemId: "",
  warehouseId: "",
  type: "INBOUND_SUPPLIER",
  quantity: "",
  technicianId: "",
  supplierName: "",
  toWarehouseId: "",
  newQuantity: "",
  notes: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";

export function InventoryMovementForm({
  items,
  warehouses,
  technicians,
  userRole,
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

  const isAdmin = userRole ? userRole === Role.ADMIN : true;

  const movementTypes = ALL_MOVEMENT_TYPES.filter((m) => !m.adminOnly || isAdmin);

  const selectedItem = items.find((item) => item.id === values.itemId);
  const isSerialized = Boolean(selectedItem?.isSerialized);

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
      toWarehouseId: "",
      newQuantity: "",
    }));

    setErrors({});
    setSubmitError(null);
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof InventoryMovementFormValues, string>> = {};

    if (!values.itemId || !items.some((item) => item.id === values.itemId)) {
      nextErrors.itemId = "يرجى اختيار صنف صحيح.";
    }

    if (isSerialized) {
      nextErrors.itemId = "لا يمكن إجراء حركة كمية على صنف متتبع بالسيريال.";
    }

    if (
      !values.warehouseId ||
      !warehouses.some((warehouse) => warehouse.id === values.warehouseId)
    ) {
      nextErrors.warehouseId = "يرجى اختيار مخزن صحيح.";
    }

    if (values.type === "ADJUSTMENT") {
      const newQty = Number(values.newQuantity);
      if (
        values.newQuantity === undefined ||
        values.newQuantity.trim() === "" ||
        !Number.isSafeInteger(newQty) ||
        newQty < 0
      ) {
        nextErrors.newQuantity = "الرصيد الجديد يجب أن يكون عددًا صحيحًا صفر أو أكبر.";
      }

      if (!values.notes || !values.notes.trim()) {
        nextErrors.notes = "ملاحظات ومبررات التسوية الجردية مطلوبة إجباريًا لأغراض التدقيق الرقابي.";
      }
    } else {
      const quantity = Number(values.quantity);

      if (!values.quantity.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) {
        nextErrors.quantity = "الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.";
      }

      if (values.type === "INBOUND_SUPPLIER" || values.type === "INBOUND") {
        if (!values.supplierName.trim()) {
          nextErrors.supplierName = "اسم المورد مطلوب عند تسجيل الوارد.";
        }
      } else if (
        values.type === "OUTBOUND_TECHNICIAN" ||
        values.type === "OUTBOUND" ||
        values.type === "RETURN_TECHNICIAN" ||
        values.type === "RETURN"
      ) {
        if (
          !values.technicianId ||
          !technicians.some((technician) => technician.id === values.technicianId)
        ) {
          nextErrors.technicianId = "يرجى اختيار الفني.";
        }
      } else if (values.type === "TRANSFER_WAREHOUSE") {
        if (
          !values.toWarehouseId ||
          !warehouses.some((warehouse) => warehouse.id === values.toWarehouseId)
        ) {
          nextErrors.toWarehouseId = "يرجى اختيار المخزن المستلم (الوجهة).";
        } else if (values.toWarehouseId === values.warehouseId) {
          nextErrors.toWarehouseId = "لا يمكن التحويل لنفس المخزن المصدر. يرجى اختيار مخزن مختلف.";
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || isSerialized || !validate()) return;

    const cleanedValues: InventoryMovementFormValues = {
      ...values,
      supplierName:
        values.type === "INBOUND_SUPPLIER" || values.type === "INBOUND"
          ? values.supplierName.trim()
          : "",
      technicianId:
        values.type === "OUTBOUND_TECHNICIAN" ||
        values.type === "OUTBOUND" ||
        values.type === "RETURN_TECHNICIAN" ||
        values.type === "RETURN"
          ? values.technicianId
          : "",
      toWarehouseId: values.type === "TRANSFER_WAREHOUSE" ? values.toWarehouseId : undefined,
      newQuantity: values.type === "ADJUSTMENT" ? values.newQuantity?.trim() : undefined,
      notes: values.notes.trim(),
      quantity: values.type === "ADJUSTMENT" ? "0" : String(Number(values.quantity)),
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
          اختر نوع الحركة وأدخل بيانات الصنف والمخزن المعني بدقة.
        </p>
      </div>

      {/* Movement Type */}
      <div>
        <p className="mb-3 text-sm font-medium">نوع الحركة *</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {movementTypes.map((movement) => {
            const Icon = movement.icon;
            const isSelected =
              values.type === movement.value ||
              (movement.value === "INBOUND_SUPPLIER" && values.type === "INBOUND") ||
              (movement.value === "OUTBOUND_TECHNICIAN" && values.type === "OUTBOUND") ||
              (movement.value === "RETURN_TECHNICIAN" && values.type === "RETURN");

            return (
              <button
                key={movement.value}
                type="button"
                disabled={loading}
                onClick={() => changeType(movement.value)}
                aria-pressed={isSelected}
                className={`rounded-xl border p-4 text-right transition-colors ${
                  isSelected
                    ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200 ring-2 ring-teal-500/20"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="mb-2 h-5 w-5 text-teal-600 dark:text-teal-400" />
                  {movement.adminOnly && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      مدراء فقط
                    </span>
                  )}
                </div>
                <p className="font-semibold">{movement.label}</p>
                <p className="mt-1 text-xs opacity-75">{movement.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Fields */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
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
                {item.name} {item.isSerialized ? "(جهاز متبع بالسيريال)" : ""}
              </option>
            ))}
          </select>
          {errors.itemId && <p className="mt-1 text-xs text-red-600">{errors.itemId}</p>}
        </div>

        {/* Serialization Guardrail Banner */}
        {isSerialized && (
          <div className="md:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  صنف خاضع للتتبع بالسيريال (راوتر / جهاز معرّف)
                </p>
                <p className="text-xs leading-relaxed opacity-90">
                  هذا الصنف خاضع للتتبع الفردي برقم السيريال (Serial Number). يمنع النظام الحركات الكمية العادية عليه حفاظاً على تتبع الأصول.
                  يرجى الانتقال إلى شاشة إدارة الراوترات لتسجيل استلام أو صرف أو تتبع هذا الجهاز.
                </p>
                <div className="pt-2">
                  <Link
                    href="/routers-preview"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                  >
                    الانتقال إلى شاشة الراوترات
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="movement-warehouse" className="mb-2 block text-sm font-medium">
            {values.type === "TRANSFER_WAREHOUSE"
              ? "المخزن المصدر *"
              : values.type === "OUTBOUND_TECHNICIAN" || values.type === "OUTBOUND"
              ? "مخزن الصرف *"
              : "المخزن *"}
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

        {/* Transfer Destination Warehouse */}
        {values.type === "TRANSFER_WAREHOUSE" && (
          <div>
            <label htmlFor="movement-to-warehouse" className="mb-2 block text-sm font-medium">
              المخزن المستلم (الوجهة) *
            </label>
            <select
              id="movement-to-warehouse"
              required
              value={values.toWarehouseId}
              onChange={(e) => updateField("toWarehouseId", e.target.value)}
              className={fieldClass}
            >
              <option value="">اختر المخزن الوجهة</option>
              {warehouses
                .filter((w) => w.id !== values.warehouseId)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
            {errors.toWarehouseId && (
              <p className="mt-1 text-xs text-red-600">{errors.toWarehouseId}</p>
            )}
          </div>
        )}

        {/* Adjustment Target Count */}
        {values.type === "ADJUSTMENT" ? (
          <div>
            <label htmlFor="movement-new-quantity" className="mb-2 block text-sm font-medium">
              الرصيد الفعلي بعد الجرد *
            </label>
            <input
              id="movement-new-quantity"
              type="number"
              required
              min={0}
              step={1}
              value={values.newQuantity ?? ""}
              onChange={(e) => updateField("newQuantity", e.target.value)}
              placeholder="أدخل الرصيد الفعلي الجديد"
              className={fieldClass}
              dir="ltr"
            />
            {errors.newQuantity && (
              <p className="mt-1 text-xs text-red-600">{errors.newQuantity}</p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="movement-quantity" className="mb-2 block text-sm font-medium">
              {values.type === "TRANSFER_WAREHOUSE" ? "الكمية المحولة *" : "الكمية *"}
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
        )}

        {/* Inbound Supplier */}
        {(values.type === "INBOUND_SUPPLIER" || values.type === "INBOUND") && (
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
              placeholder="اسم المورد أو الشركة الموردة"
              className={fieldClass}
            />
            {errors.supplierName && (
              <p className="mt-1 text-xs text-red-600">{errors.supplierName}</p>
            )}
          </div>
        )}

        {/* Technician for Outbound / Return */}
        {(values.type === "OUTBOUND_TECHNICIAN" ||
          values.type === "OUTBOUND" ||
          values.type === "RETURN_TECHNICIAN" ||
          values.type === "RETURN") && (
          <div>
            <label htmlFor="movement-technician" className="mb-2 block text-sm font-medium">
              {values.type === "OUTBOUND_TECHNICIAN" || values.type === "OUTBOUND"
                ? "الفني المستلم *"
                : "الفني المرتجع منه *"}
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
            {values.type === "ADJUSTMENT"
              ? "ملاحظات ومبررات التسوية الجردية (إجباري) *"
              : "ملاحظات"}
          </label>
          <textarea
            id="movement-notes"
            rows={3}
            maxLength={1000}
            required={values.type === "ADJUSTMENT"}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder={
              values.type === "ADJUSTMENT"
                ? "اذكر سبب التعديل الجردي (عجز مخزني، فائض، كسر، تدقيق دوري)..."
                : "ملاحظات إضافية عن الحركة..."
            }
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-teal-500"
          />
          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes}</p>}
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            فشلت العملية
          </div>
          <p className="mt-1 text-xs">{submitError}</p>
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
          disabled={loading || isSerialized}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {loading ? "جاري التسجيل..." : "تسجيل الحركة"}
        </button>
      </div>
    </form>
  );
}
