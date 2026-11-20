"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Save, X, Lock } from "lucide-react";
import type { Department } from "@alfahd/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeRow, UpdateEmployeeValues, WarehouseOption } from "./types";
import { EMPLOYEE_DEPARTMENTS } from "./employee-filters";
import { EmployeeStatusBadge } from "./employee-status-badge";

interface EmployeeEditFormProps {
  employee: EmployeeRow;
  warehouses: WarehouseOption[];
  onSubmit: (values: UpdateEmployeeValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function EmployeeEditForm({
  employee,
  warehouses,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EmployeeEditFormProps) {
  const [values, setValues] = useState<UpdateEmployeeValues>({
    name: employee.name || "",
    department: (employee.department as Department) || "",
    phone: employee.phone || "",
    warehouseId: employee.assignedWarehouseId || employee.warehouseId || "",
    assignedWarehouseId: employee.assignedWarehouseId || employee.warehouseId || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const isBusy = isSubmitting || localSubmitting;

  const updateField = <K extends keyof UpdateEmployeeValues>(field: K, val: UpdateEmployeeValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [field]: val };
      if (field === "warehouseId") {
        next.assignedWarehouseId = val as string;
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    setGeneralError(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedName = values.name.trim();
    if (!trimmedName) {
      newErrors.name = "اسم الموظف مطلوب.";
    } else if (trimmedName.length > 255) {
      newErrors.name = "اسم الموظف يجب ألا يتجاوز 255 حرفاً.";
    }

    if (employee.role === "TECHNICIAN" && !values.warehouseId) {
      newErrors.warehouseId = "المخزن التابع له إلزامي للفنيين الميدانيين.";
    }

    if (values.phone && values.phone.trim().length > 30) {
      newErrors.phone = "رقم الهاتف يجب ألا يتجاوز 30 حرفاً/رقماً.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    if (!validate()) return;

    try {
      setLocalSubmitting(true);
      setGeneralError(null);

      const cleanedValues: UpdateEmployeeValues = {
        name: values.name.trim(),
        department: values.department,
        phone: values.phone.trim(),
        assignedWarehouseId: values.assignedWarehouseId || values.warehouseId || undefined,
        warehouseId: values.warehouseId || values.assignedWarehouseId || "",
      };

      await onSubmit(cleanedValues);
    } catch (err) {
      // Preserve form values on error!
      setGeneralError(err instanceof Error ? err.message : "حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setLocalSubmitting(false);
    }
  };

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl" noValidate>
      <div>
        <h2 className="text-xl font-bold text-foreground">تعديل بيانات الموظف</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تعديل البيانات القابلة للتحديث طبقاً لسياسات الأمان وصلاحيات النظام.
        </p>
      </div>

      {generalError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {generalError}
        </div>
      )}

      {/* Read-only Identity / Security Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            بيانات الهوية والصلاحيات (غير قابلة للتعديل المباشر)
          </span>
          <EmployeeStatusBadge status={employee.status} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <span className="text-muted-foreground">البريد الإلكتروني:</span>
            <p className="font-semibold text-foreground mt-0.5" dir="ltr">
              {employee.email}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">الدور الوظيفي:</span>
            <p className="font-semibold text-foreground mt-0.5">
              {employee.role}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">الرقم القومي:</span>
            <p className="font-semibold text-foreground mt-0.5" dir="ltr">
              {employee.nationalId || "غير مسجل"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">تاريخ التعيين:</span>
            <p className="font-semibold text-foreground mt-0.5">
              {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString("ar-EG") : "غير مسجل"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          * البريد الإلكتروني والدور والرقم القومي محمية لمنع اختراق الهوية؛ لتغيير الحالة أو الدور، استخدم الإجراءات الإدارية المخصصة.
        </p>
      </div>

      {/* Editable Fields */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Name */}
        <div>
          <label htmlFor="edit-emp-name" className="mb-2 block text-sm font-medium text-foreground">
            اسم الموظف <span className="text-destructive">*</span>
          </label>
          <Input
            id="edit-emp-name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="الاسم بالكامل"
            maxLength={255}
            disabled={isBusy}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Department */}
        <div>
          <label htmlFor="edit-emp-dept" className="mb-2 block text-sm font-medium text-foreground">
            القسم
          </label>
          <select
            id="edit-emp-dept"
            value={values.department}
            onChange={(e) => updateField("department", e.target.value as Department)}
            disabled={isBusy}
            className={selectClass}
          >
            <option value="">(غير محدد)</option>
            {EMPLOYEE_DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="edit-emp-phone" className="mb-2 block text-sm font-medium text-foreground">
            رقم الهاتف
          </label>
          <Input
            id="edit-emp-phone"
            type="tel"
            dir="ltr"
            value={values.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="01xxxxxxxxx"
            maxLength={30}
            disabled={isBusy}
          />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>

        {/* Assigned Warehouse */}
        <div>
          <label htmlFor="edit-emp-wh" className="mb-2 block text-sm font-medium text-foreground">
            المخزن التابع له {employee.role === "TECHNICIAN" && <span className="text-destructive">*</span>}
          </label>
          <select
            id="edit-emp-wh"
            value={values.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
            disabled={isBusy}
            className={selectClass}
            aria-invalid={Boolean(errors.warehouseId)}
          >
            <option value="">{employee.role === "TECHNICIAN" ? "اختر المخزن (إلزامي للفني)" : "(بدون تعيين مخزن)"}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
          {errors.warehouseId && <p className="mt-1 text-xs text-destructive">{errors.warehouseId}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5">
        {onCancel && (
          <Button type="button" variant="outline" disabled={isBusy} onClick={onCancel}>
            <X className="ml-1 h-4 w-4" />
            إلغاء
          </Button>
        )}

        <Button
          type="submit"
          disabled={isBusy}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              حفظ التعديلات
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
