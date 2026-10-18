"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save, X } from "lucide-react";

import type { EmployeeRow } from "./employee-table";

export interface EmployeeFormValues {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  warehouseName: string;
  status: "ACTIVE" | "INACTIVE";
}

interface EmployeeFormProps {
  employee?: EmployeeRow | null;
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
  warehouseName: "",
  status: "ACTIVE",
};

// Temporary values until the backend contract is confirmed.
const DEPARTMENTS = [
  { value: "WAREHOUSE", label: "المخازن" },
  { value: "TECHNICAL", label: "القسم الفني" },
  { value: "CUSTOMER_SERVICE", label: "خدمة العملاء" },
  { value: "MANAGEMENT", label: "الإدارة" },
];

const ROLES = [
  { value: "ADMIN", label: "مدير النظام" },
  { value: "WAREHOUSE_STAFF", label: "موظف مخزن" },
  { value: "CS", label: "خدمة العملاء" },
  { value: "TECHNICIAN", label: "فني" },
];

function getInitialValues(employee?: EmployeeRow | null): EmployeeFormValues {
  if (!employee) return { ...EMPTY_VALUES };

  return {
    name: employee.name,
    email: employee.email,
    phone: employee.phone ?? "",
    department: employee.department,
    role: employee.role,
    warehouseName: employee.warehouseName ?? "",
    status: employee.status,
  };
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 " +
  "bg-background px-3 text-sm outline-none " +
  "transition-colors focus:border-teal-500 " +
  "focus:ring-2 focus:ring-teal-500/10";

const labelClass = "mb-2 block text-sm font-medium text-foreground";

export function EmployeeForm({
  employee,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EmployeeFormProps) {
  const isEdit = Boolean(employee);

  const [values, setValues] = useState<EmployeeFormValues>(() => getInitialValues(employee));

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [localSubmitting, setLocalSubmitting] = useState(false);

  const loading = isSubmitting || localSubmitting;

  useEffect(() => {
    setValues(getInitialValues(employee));
    setSubmitError(null);
  }, [employee]);

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
      warehouseName: values.warehouseName.trim(),
    };

    if (!cleanedValues.name || !cleanedValues.email) {
      setSubmitError("يرجى إدخال الاسم والبريد الإلكتروني.");
      return;
    }

    if (!cleanedValues.department || !cleanedValues.role) {
      setSubmitError("يرجى اختيار القسم والدور.");
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="employee-name" className={labelClass}>
            اسم الموظف *
          </label>
          <input
            id="employee-name"
            type="text"
            required
            maxLength={150}
            autoComplete="name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="الاسم بالكامل"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="employee-email" className={labelClass}>
            البريد الإلكتروني *
          </label>
          <input
            id="employee-email"
            type="email"
            required
            autoComplete="email"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="example@company.com"
            className={inputClass}
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="employee-phone" className={labelClass}>
            رقم الهاتف
          </label>
          <input
            id="employee-phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="رقم الهاتف"
            className={inputClass}
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="employee-department" className={labelClass}>
            القسم *
          </label>
          <select
            id="employee-department"
            required
            value={values.department}
            onChange={(e) => updateField("department", e.target.value)}
            className={inputClass}
          >
            <option value="">اختر القسم</option>
            {DEPARTMENTS.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="employee-role" className={labelClass}>
            الدور *
          </label>
          <select
            id="employee-role"
            required
            value={values.role}
            onChange={(e) => updateField("role", e.target.value)}
            className={inputClass}
          >
            <option value="">اختر الدور</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="employee-warehouse" className={labelClass}>
            المخزن التابع له
          </label>
          <input
            id="employee-warehouse"
            type="text"
            value={values.warehouseName}
            onChange={(e) => updateField("warehouseName", e.target.value)}
            placeholder="اسم المخزن"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            مؤقتًا لحين ربط قائمة المخازن الفعلية.
          </p>
        </div>

        <div>
          <label htmlFor="employee-status" className={labelClass}>
            الحالة
          </label>
          <select
            id="employee-status"
            value={values.status}
            onChange={(e) => updateField("status", e.target.value as EmployeeFormValues["status"])}
            className={inputClass}
          >
            <option value="ACTIVE">نشط</option>
            <option value="INACTIVE">غير نشط</option>
          </select>
        </div>
      </div>

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
