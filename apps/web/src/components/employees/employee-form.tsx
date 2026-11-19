"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Lock, Save, X } from "lucide-react";
import type { UserStatus } from "@alfahd/types";

import type { EmployeeRow } from "./employee-table";
import { EMPLOYEE_STATUS_OPTIONS } from "./employee-status-badge";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_ROLES } from "./employee-filters";

export interface EmployeeFormValues {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  warehouseId: string;
  status: UserStatus;
  statusReason: string;
  nationalId?: string;
  hireDate?: string;
}

interface EmployeeFormProps {
  employee?: EmployeeRow | null;
  warehouses: { id: string; name: string }[];
  onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const EMPTY_VALUES: EmployeeFormValues = {
  name: "",
  email: "",
  phone: "",
  department: "",
  role: "",
  warehouseId: "",
  status: "ACTIVE",
  statusReason: "",
  nationalId: "",
  hireDate: "",
};

function getInitialValues(employee?: EmployeeRow | null): EmployeeFormValues {
  if (!employee) return { ...EMPTY_VALUES };

  return {
    name: employee.name,
    email: employee.email,
    phone: employee.phone ?? "",
    department: (employee.department as string) ?? "",
    role: (employee.role as string) ?? "",
    warehouseId: employee.warehouseId ?? "",
    status: employee.status,
    statusReason: "",
    nationalId: employee.nationalId ?? "",
    hireDate: employee.hireDate ?? "",
  };
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 " +
  "bg-background px-3 text-sm outline-none " +
  "transition-colors focus:border-teal-500 " +
  "focus:ring-2 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60";

const labelClass = "mb-2 block text-sm font-medium text-foreground";

export function EmployeeForm({
  employee,
  warehouses,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EmployeeFormProps) {
  const isEdit = Boolean(employee);

  const [values, setValues] = useState<EmployeeFormValues>(() => getInitialValues(employee));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;
  const statusChanged = Boolean(employee && values.status !== employee.status);

  function updateField<K extends keyof EmployeeFormValues>(field: K, value: EmployeeFormValues[K]) {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const cleanedValues: EmployeeFormValues = {
      ...values,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      statusReason: values.statusReason.trim(),
      nationalId: values.nationalId ? values.nationalId.trim() : "",
      hireDate: values.hireDate ? values.hireDate.trim() : "",
    };

    if (!cleanedValues.name || !cleanedValues.email) {
      setSubmitError("يرجى إدخال الاسم والبريد الإلكتروني.");
      return;
    }

    if (!cleanedValues.role) {
      setSubmitError("يرجى اختيار الدور الوظيفي.");
      return;
    }

    if (
      (cleanedValues.role === "TECHNICIAN" || cleanedValues.warehouseId) &&
      !warehouses.some((warehouse) => warehouse.id === cleanedValues.warehouseId)
    ) {
      setSubmitError("يرجى اختيار مخزن موجود للفني.");
      return;
    }

    if (cleanedValues.nationalId && !/^\d{14}$/.test(cleanedValues.nationalId)) {
      setSubmitError("الرقم القومي يجب أن يتكون من 14 رقماً.");
      return;
    }

    if (statusChanged && !cleanedValues.statusReason) {
      setSubmitError("سبب تغيير الحالة مطلوب.");
      return;
    }

    try {
      setLocalSubmitting(true);
      setSubmitError(null);
      await onSubmit(cleanedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "حدث خطأ أثناء تنفيذ العملية.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          {isEdit ? "تعديل بيانات موظف" : "إضافة موظف جديد"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit ? "قم بتحديث بيانات الموظف المطلوبة." : "أدخل البيانات الأساسية للموظف الجديد."}
        </p>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            تعديل البريد الإلكتروني والدور الوظيفي مقفل في واجهة التعديل طبقاً لقواعد الأمان والـ Backend Contract.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Name */}
        <div>
          <label htmlFor="employee-name" className={labelClass}>
            اسم الموظف *
          </label>
          <input
            id="employee-name"
            type="text"
            required
            maxLength={255}
            autoComplete="name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="الاسم بالكامل"
            disabled={loading}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="employee-email" className={labelClass}>
            البريد الإلكتروني * {isEdit && "(غير قابل للتعديل)"}
          </label>
          <input
            id="employee-email"
            type="email"
            required
            autoComplete="email"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="example@company.com"
            disabled={loading || isEdit}
            className={inputClass}
            dir="ltr"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="employee-phone" className={labelClass}>
            رقم الهاتف
          </label>
          <input
            id="employee-phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={values.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="01xxxxxxxxx"
            disabled={loading}
            className={inputClass}
            dir="ltr"
          />
        </div>

        {/* National ID */}
        <div>
          <label htmlFor="employee-nid" className={labelClass}>
            الرقم القومي (14 رقماً) {isEdit && "(غير قابل للتعديل)"}
          </label>
          <input
            id="employee-nid"
            type="text"
            maxLength={14}
            value={values.nationalId}
            onChange={(e) => updateField("nationalId", e.target.value.replace(/\D/g, ""))}
            placeholder="2xxxxxxxxxxxxx"
            disabled={loading || isEdit}
            className={inputClass}
            dir="ltr"
          />
        </div>

        {/* Hire Date */}
        <div>
          <label htmlFor="employee-hiredate" className={labelClass}>
            تاريخ التعيين {isEdit && "(غير قابل للتعديل)"}
          </label>
          <input
            id="employee-hiredate"
            type="date"
            value={values.hireDate}
            onChange={(e) => updateField("hireDate", e.target.value)}
            disabled={loading || isEdit}
            className={inputClass}
            dir="ltr"
          />
        </div>

        {/* Department */}
        <div>
          <label htmlFor="employee-department" className={labelClass}>
            القسم
          </label>
          <select
            id="employee-department"
            value={values.department}
            onChange={(e) => updateField("department", e.target.value)}
            disabled={loading}
            className={inputClass}
          >
            <option value="">اختر القسم</option>
            {EMPLOYEE_DEPARTMENTS.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label htmlFor="employee-role" className={labelClass}>
            الدور * {isEdit && "(غير قابل للتعديل)"}
          </label>
          <select
            id="employee-role"
            required
            value={values.role}
            onChange={(e) => updateField("role", e.target.value)}
            disabled={loading || isEdit}
            className={inputClass}
          >
            <option value="">اختر الدور</option>
            {EMPLOYEE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse */}
        <div>
          <label htmlFor="employee-warehouse" className={labelClass}>
            المخزن التابع له {values.role === "TECHNICIAN" && "*"}
          </label>
          <select
            id="employee-warehouse"
            required={values.role === "TECHNICIAN"}
            value={values.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
            disabled={loading}
            className={inputClass}
          >
            <option value="">اختر المخزن</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            اختيار المخزن إلزامي للفنيين الميدانيين (TECHNICIAN).
          </p>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="employee-status" className={labelClass}>
            الحالة
          </label>
          <select
            id="employee-status"
            value={values.status}
            onChange={(e) => updateField("status", e.target.value as UserStatus)}
            disabled={loading}
            className={inputClass}
          >
            {EMPLOYEE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusChanged && (
        <div className="space-y-2">
          {values.status === "INACTIVE" && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <strong>تحذير أمني:</strong> تحويل الموظف إلى «غير نشط» سيؤدي إلى إنهاء جميع جلساته النشطة فوراً ومنعه من الدخول.
            </div>
          )}

          <div>
            <label htmlFor="employee-status-reason" className={labelClass}>
              سبب تغيير الحالة *
            </label>
            <input
              id="employee-status-reason"
              required
              value={values.statusReason}
              onChange={(event) => updateField("statusReason", event.target.value)}
              placeholder="سبب إلزامي لتسجيل التدقيق الأمني..."
              disabled={loading}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {employee && employee.statusChanges && employee.statusChanges.length > 0 && (
        <section aria-label="سجل تغييرات الحالة" className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm">سجل تغييرات الحالة — معاينة التدقيق</h3>
          <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
            {employee.statusChanges.map((change, index) => (
              <li key={index} className="rounded border p-2">
                <time dateTime={change.changedAt} className="font-medium text-foreground">
                  {new Date(change.changedAt).toLocaleString("ar-EG")}
                </time>
                {" — "}{change.from}{" ← "}{change.to}{": "}{change.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
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
          {loading ? "جاري التنفيذ..." : isEdit ? "حفظ التعديلات" : "إضافة الموظف"}
        </button>
      </div>
    </form>
  );
}
