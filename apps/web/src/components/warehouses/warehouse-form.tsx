"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MapPin, Save, X } from "lucide-react";
import type { EmployeeLookupDto } from "@/core/api/types";
import { WarehouseManagerSelect } from "./warehouse-manager-select";
import type {
  ManagerOption,
  ManagerSelector,
  WarehouseFormValues,
  WarehouseRow,
} from "./types";

export interface WarehouseFormProps {
  warehouse?: WarehouseRow | null;
  managers?: ManagerSelector | readonly ManagerOption[] | EmployeeLookupDto[];
  isLoadingManagers?: boolean;
  onSubmit: (values: WarehouseFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  serverError?: string | null;
  fieldErrors?: Partial<Record<keyof WarehouseFormValues, string>>;
}

const EMPTY_VALUES: WarehouseFormValues = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  geofenceRadiusMeters: "150",
  managerId: "",
};

function getInitialValues(warehouse?: WarehouseRow | null): WarehouseFormValues {
  if (!warehouse) {
    return { ...EMPTY_VALUES };
  }

  return {
    name: warehouse.name,
    address: warehouse.address,
    latitude: String(warehouse.latitude),
    longitude: String(warehouse.longitude),
    geofenceRadiusMeters: String(warehouse.geofenceRadiusMeters ?? 150),
    managerId: warehouse.managerId ?? "",
  };
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 " +
  "bg-background px-3 text-sm outline-none transition-colors " +
  "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-800";

const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

function isManagerSelector(
  m: unknown
): m is ManagerSelector {
  return typeof m === "object" && m !== null && "options" in m;
}

export function WarehouseForm({
  warehouse,
  managers,
  isLoadingManagers = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  serverError = null,
  fieldErrors = {},
}: WarehouseFormProps) {
  const isEdit = Boolean(warehouse);

  const [values, setValues] = useState<WarehouseFormValues>(() => getInitialValues(warehouse));
  const [clientErrors, setClientErrors] = useState<Partial<Record<keyof WarehouseFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  // Convert managers prop to ManagerOption[] or pass selector directly
  let managerSelector: ManagerSelector | undefined;
  let directManagerOptions: ManagerOption[] | undefined;

  if (isManagerSelector(managers)) {
    managerSelector = managers;
  } else if (Array.isArray(managers)) {
    directManagerOptions = managers
      .filter((m) => {
        const roleMatches = m.role === "ADMIN" || m.role === "WAREHOUSE_STAFF";
        const statusMatches = !("status" in m) || m.status === "ACTIVE";
        return roleMatches && statusMatches;
      })
      .map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role as "ADMIN" | "WAREHOUSE_STAFF",
        status: "ACTIVE" as const,
      }));
  }

  function updateField(field: keyof WarehouseFormValues, value: string) {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));

    setClientErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setSubmitError(null);
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof WarehouseFormValues, string>> = {};

    if (!values.name.trim()) {
      nextErrors.name = "اسم المخزن مطلوب.";
    } else if (values.name.trim().length > 255) {
      nextErrors.name = "اسم المخزن يجب ألا يتجاوز 255 حرفًا.";
    }

    if (!values.address.trim()) {
      nextErrors.address = "عنوان المخزن مطلوب.";
    }

    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);

    if (!values.latitude.trim()) {
      nextErrors.latitude = "خط العرض مطلوب.";
    } else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      nextErrors.latitude = "خط العرض يجب أن يكون رقمًا صالحًا بين -90 و90.";
    }

    if (!values.longitude.trim()) {
      nextErrors.longitude = "خط الطول مطلوب.";
    } else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      nextErrors.longitude = "خط الطول يجب أن يكون رقمًا صالحًا بين -180 و180.";
    }

    const geofence = Number(values.geofenceRadiusMeters);
    if (!values.geofenceRadiusMeters.trim()) {
      nextErrors.geofenceRadiusMeters = "نطاق السياج الجغرافي مطلوب.";
    } else if (!Number.isInteger(geofence) || geofence < 50 || geofence > 2000) {
      nextErrors.geofenceRadiusMeters = "نطاق السياج الجغرافي يجب أن يكون رقمًا صحيحًا بين 50 و 2000 متر.";
    }

    setClientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !validate()) return;

    const cleanedValues: WarehouseFormValues = {
      name: values.name.trim(),
      address: values.address.trim(),
      latitude: values.latitude.trim(),
      longitude: values.longitude.trim(),
      geofenceRadiusMeters: values.geofenceRadiusMeters.trim(),
      managerId: values.managerId.trim(),
    };

    try {
      setLocalSubmitting(true);
      setSubmitError(null);
      await onSubmit(cleanedValues);
    } catch (error) {
      // Preserve inputs and display error
      setSubmitError(
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ بيانات المخزن."
      );
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
          {isEdit ? "تعديل بيانات المخزن" : "إضافة مخزن جديد"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل بيانات المخزن والموقع الجغرافي ونطاق السياج المطلوب.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Warehouse Name */}
        <div>
          <label htmlFor="warehouse-name" className={labelClass}>
            اسم المخزن *
          </label>
          <input
            id="warehouse-name"
            type="text"
            required
            maxLength={255}
            disabled={loading}
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="اسم المخزن (مثال: مخزن القاهرة الرئيسي)"
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "warehouse-name-error" : undefined}
          />
          {errors.name && (
            <p id="warehouse-name-error" className="mt-1 text-xs text-red-600">
              {errors.name}
            </p>
          )}
        </div>

        {/* Physical Address */}
        <div>
          <label htmlFor="warehouse-address" className={labelClass}>
            عنوان المخزن *
          </label>
          <input
            id="warehouse-address"
            type="text"
            required
            disabled={loading}
            value={values.address}
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="العنوان التفصيلي للمقر"
            className={inputClass}
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? "warehouse-address-error" : undefined}
          />
          {errors.address && (
            <p id="warehouse-address-error" className="mt-1 text-xs text-red-600">
              {errors.address}
            </p>
          )}
        </div>

        {/* Latitude */}
        <div>
          <label htmlFor="warehouse-latitude" className={labelClass}>
            خط العرض (Latitude) *
          </label>
          <input
            id="warehouse-latitude"
            type="number"
            required
            step="any"
            min={-90}
            max={90}
            disabled={loading}
            value={values.latitude}
            onChange={(event) => updateField("latitude", event.target.value)}
            placeholder="30.0444"
            className={inputClass}
            dir="ltr"
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={errors.latitude ? "warehouse-latitude-error" : undefined}
          />
          <p className="mt-1 text-xs text-muted-foreground">رقم بين -90 و 90.</p>
          {errors.latitude && (
            <p id="warehouse-latitude-error" className="mt-1 text-xs text-red-600">
              {errors.latitude}
            </p>
          )}
        </div>

        {/* Longitude */}
        <div>
          <label htmlFor="warehouse-longitude" className={labelClass}>
            خط الطول (Longitude) *
          </label>
          <input
            id="warehouse-longitude"
            type="number"
            required
            step="any"
            min={-180}
            max={180}
            disabled={loading}
            value={values.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
            placeholder="31.2357"
            className={inputClass}
            dir="ltr"
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={errors.longitude ? "warehouse-longitude-error" : undefined}
          />
          <p className="mt-1 text-xs text-muted-foreground">رقم بين -180 و 180.</p>
          {errors.longitude && (
            <p id="warehouse-longitude-error" className="mt-1 text-xs text-red-600">
              {errors.longitude}
            </p>
          )}
        </div>

        {/* Geofence Radius */}
        <div>
          <label htmlFor="warehouse-geofence" className={labelClass}>
            نطاق السياج الجغرافي (بالأمتار) *
          </label>
          <input
            id="warehouse-geofence"
            type="number"
            required
            min={50}
            max={2000}
            step={1}
            disabled={loading}
            value={values.geofenceRadiusMeters}
            onChange={(event) => updateField("geofenceRadiusMeters", event.target.value)}
            placeholder="150"
            className={inputClass}
            dir="ltr"
            aria-invalid={Boolean(errors.geofenceRadiusMeters)}
            aria-describedby={errors.geofenceRadiusMeters ? "warehouse-geofence-error" : undefined}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            نطاق مسموح به بين 50 و 2000 متر (القيمة الافتراضية: 150م).
          </p>
          {errors.geofenceRadiusMeters && (
            <p id="warehouse-geofence-error" className="mt-1 text-xs text-red-600">
              {errors.geofenceRadiusMeters}
            </p>
          )}
        </div>

        {/* Typed Manager Selector (Criterion D) */}
        <div>
          <WarehouseManagerSelect
            id="warehouse-manager"
            value={values.managerId}
            onChange={(val) => updateField("managerId", val)}
            selector={managerSelector}
            options={directManagerOptions}
            isLoading={isLoadingManagers}
            disabled={loading}
            error={errors.managerId}
            currentOnly={
              warehouse?.managerId && !values.managerId
                ? null
                : warehouse?.managerId === values.managerId
                ? managerSelector?.currentOnly
                : null
            }
          />
        </div>
      </div>

      {/* Geofence Explanatory Banner */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
          <div>
            <p className="text-sm font-semibold text-foreground">السياج والموقع الجغرافي</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              تُستخدم الإحداثيات ونطاق السياج للتحقق من موقع الفنيين والموظفين أثناء تسجيل الحضور
              والانصراف. يتم حساب المسافة تلقائيًا على الخادم (بحد أدنى 50 مترًا وأقصى 2000 متر).
            </p>
          </div>
        </div>
      </div>

      {/* Server Error Alert */}
      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {activeError}
        </div>
      )}

      {/* Actions */}
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
          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المخزن"}
        </button>
      </div>
    </form>
  );
}
