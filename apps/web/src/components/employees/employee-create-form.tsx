"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { Loader2, Plus, X, Upload, AlertTriangle, RotateCw } from "lucide-react";
import type { Role, Department } from "@alfahd/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateEmployeeValues, WarehouseOption } from "./types";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_ROLES } from "./employee-filters";

interface EmployeeCreateFormProps {
  warehouses: WarehouseOption[];
  onSubmit: (values: CreateEmployeeValues) => Promise<{ id?: string; photoUploadError?: string } | void>;
  onRetryPhotoUpload?: (employeeId: string, photo: File) => Promise<void>;
  onCancel?: () => void;
  onSuccess?: (employeeId?: string) => void;
  isSubmitting?: boolean;
}

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (aligns with backend Multer limit)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const INITIAL_VALUES: CreateEmployeeValues = {
  name: "",
  email: "",
  role: "TECHNICIAN" as Role,
  department: "TECHNICAL" as Department,
  phone: "",
  nationalId: "",
  hireDate: "",
  warehouseId: "",
  photoFile: null,
};

export function EmployeeCreateForm({
  warehouses,
  onSubmit,
  onRetryPhotoUpload,
  onCancel,
  onSuccess,
  isSubmitting = false,
}: EmployeeCreateFormProps) {
  const [values, setValues] = useState<CreateEmployeeValues>(INITIAL_VALUES);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  // Distinct state for: Employee created successfully, but photo upload failed
  const [photoFailure, setPhotoFailure] = useState<{
    employeeId: string;
    employeeName: string;
    photoFile: File;
    errorMessage: string;
  } | null>(null);
  const [isRetryingPhoto, setIsRetryingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isSubmitting || localSubmitting || isRetryingPhoto;

  const updateField = <K extends keyof CreateEmployeeValues>(field: K, val: CreateEmployeeValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    setGeneralError(null);
  };

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        photoFile: "نوع الصورة غير مدعوم. يرجى اختيار ملف JPEG أو PNG أو WebP.",
      }));
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        photoFile: "حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).",
      }));
      return;
    }

    // Valid file
    setValues((prev) => ({ ...prev, photoFile: file }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.photoFile;
      return copy;
    });

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  const removePhoto = () => {
    setValues((prev) => ({ ...prev, photoFile: null }));
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedName = values.name.trim();
    if (!trimmedName) {
      newErrors.name = "اسم الموظف مطلوب.";
    } else if (trimmedName.length > 255) {
      newErrors.name = "اسم الموظف يجب ألا يتجاوز 255 حرفاً.";
    }

    const trimmedEmail = values.email.trim();
    if (!trimmedEmail) {
      newErrors.email = "البريد الإلكتروني مطلوب.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "يرجى إدخال بريد إلكتروني صالح.";
    }

    if (!values.role) {
      newErrors.role = "يرجى تحديد دور الموظف.";
    }

    if (values.role === "TECHNICIAN" && !values.warehouseId) {
      newErrors.warehouseId = "المخزن التابع له إلزامي للفنيين الميدانيين.";
    }

    if (values.nationalId && values.nationalId.trim()) {
      const idClean = values.nationalId.trim();
      if (!/^\d{14}$/.test(idClean)) {
        newErrors.nationalId = "الرقم القومي يجب أن يتكون من 14 رقماً.";
      }
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

      const cleanedValues: CreateEmployeeValues = {
        ...values,
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        nationalId: values.nationalId.trim(),
        hireDate: values.hireDate.trim(),
      };

      const result = await onSubmit(cleanedValues);

      if (result && result.id && result.photoUploadError && values.photoFile) {
        // Handled distinct partial failure: user created, photo failed
        setPhotoFailure({
          employeeId: result.id,
          employeeName: cleanedValues.name,
          photoFile: values.photoFile,
          errorMessage: result.photoUploadError,
        });
        return;
      }

      onSuccess?.(result?.id);
    } catch (err) {
      // Preserve form values on error!
      setGeneralError(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الموظف.");
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleRetryPhoto = async () => {
    if (!photoFailure || !onRetryPhotoUpload || isRetryingPhoto) return;

    try {
      setIsRetryingPhoto(true);
      setGeneralError(null);
      await onRetryPhotoUpload(photoFailure.employeeId, photoFailure.photoFile);
      // Photo retry succeeded!
      setPhotoFailure(null);
      onSuccess?.(photoFailure.employeeId);
    } catch (err) {
      setPhotoFailure((prev) =>
        prev
          ? {
              ...prev,
              errorMessage:
                err instanceof Error ? err.message : "فشلت إعادة محاولة رفع الصورة مرة أخرى.",
            }
          : null
      );
    } finally {
      setIsRetryingPhoto(false);
    }
  };

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  // If we are in the photo-failed state, display the distinct recovery UI
  if (photoFailure) {
    return (
      <div className="space-y-6 rounded-xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-900 dark:bg-amber-950/30" dir="rtl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
              تم إنشاء حساب الموظف بنجاح، ولكن فشل رفع الصورة الشخصية
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              تم تسجيل الموظف <strong>{photoFailure.employeeName}</strong> بنجاح في قاعدة البيانات.
              حدث خطأ أثناء رفع ملف الصورة:
            </p>
            <div className="rounded-md border border-amber-300 bg-white/70 px-3 py-2 text-xs font-mono text-amber-900 dark:border-amber-800 dark:bg-black/30 dark:text-amber-300">
              {photoFailure.errorMessage}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              لن يتم تكرار إنشاء حساب الموظف عند إعادة المحاولة؛ سيتم فقط رفع الصورة وربطها بالموظف الحالي.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-amber-200 pt-4 dark:border-amber-900">
          <Button
            type="button"
            variant="outline"
            disabled={isRetryingPhoto}
            onClick={() => {
              setPhotoFailure(null);
              onSuccess?.(photoFailure.employeeId);
            }}
          >
            تخطي ومتابعة بدون صورة
          </Button>

          <Button
            type="button"
            disabled={isRetryingPhoto}
            onClick={handleRetryPhoto}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isRetryingPhoto ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري إعادة رفع الصورة...
              </>
            ) : (
              <>
                <RotateCw className="h-4 w-4" />
                إعادة محاولة رفع الصورة
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl" noValidate>
      <div>
        <h2 className="text-xl font-bold text-foreground">إضافة موظف جديد</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل بيانات الموظف الأساسية وفقاً لصلاحيات وحقول النظام.
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

      {/* Profile Photo Uploader */}
      <div className="rounded-xl border border-dashed border-input p-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          الصورة الشخصية (اختياري)
        </label>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-muted">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="معاينة الصورة" className="h-full w-full object-cover" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-right">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              disabled={isBusy}
              className="hidden"
              id="employee-photo-file"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {photoPreview ? "تغيير الصورة" : "اختر صورة"}
              </Button>

              {photoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={removePhoto}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 ml-1" />
                  إزالة
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              صيغ مدعومة: JPEG, PNG, WebP — الحد الأقصى: 5 ميجابايت (يفضل صورة مربعة للوجه).
            </p>
            {errors.photoFile && (
              <p className="text-xs font-medium text-destructive">{errors.photoFile}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Full Name */}
        <div>
          <label htmlFor="create-emp-name" className="mb-2 block text-sm font-medium text-foreground">
            الاسم الكامل <span className="text-destructive">*</span>
          </label>
          <Input
            id="create-emp-name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="الاسم الرباعي كما في الهوية"
            maxLength={255}
            disabled={isBusy}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="create-emp-email" className="mb-2 block text-sm font-medium text-foreground">
            البريد الإلكتروني <span className="text-destructive">*</span>
          </label>
          <Input
            id="create-emp-email"
            type="email"
            dir="ltr"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="employee@alfahd.com"
            disabled={isBusy}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="create-emp-role" className="mb-2 block text-sm font-medium text-foreground">
            الدور الوظيفي <span className="text-destructive">*</span>
          </label>
          <select
            id="create-emp-role"
            value={values.role}
            onChange={(e) => updateField("role", e.target.value as Role)}
            disabled={isBusy}
            className={selectClass}
          >
            {EMPLOYEE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role}</p>}
        </div>

        {/* Department */}
        <div>
          <label htmlFor="create-emp-dept" className="mb-2 block text-sm font-medium text-foreground">
            القسم
          </label>
          <select
            id="create-emp-dept"
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
          <label htmlFor="create-emp-phone" className="mb-2 block text-sm font-medium text-foreground">
            رقم الهاتف
          </label>
          <Input
            id="create-emp-phone"
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

        {/* National ID */}
        <div>
          <label htmlFor="create-emp-nid" className="mb-2 block text-sm font-medium text-foreground">
            الرقم القومي (14 رقماً)
          </label>
          <Input
            id="create-emp-nid"
            dir="ltr"
            value={values.nationalId}
            onChange={(e) => updateField("nationalId", e.target.value.replace(/\D/g, ""))}
            placeholder="2xxxxxxxxxxxxx"
            maxLength={14}
            disabled={isBusy}
            aria-invalid={Boolean(errors.nationalId)}
          />
          {errors.nationalId && <p className="mt-1 text-xs text-destructive">{errors.nationalId}</p>}
        </div>

        {/* Hire Date */}
        <div>
          <label htmlFor="create-emp-hiredate" className="mb-2 block text-sm font-medium text-foreground">
            تاريخ التعيين
          </label>
          <Input
            id="create-emp-hiredate"
            type="date"
            dir="ltr"
            value={values.hireDate}
            onChange={(e) => updateField("hireDate", e.target.value)}
            disabled={isBusy}
          />
        </div>

        {/* Assigned Warehouse */}
        <div>
          <label htmlFor="create-emp-wh" className="mb-2 block text-sm font-medium text-foreground">
            المخزن التابع له {values.role === "TECHNICIAN" && <span className="text-destructive">*</span>}
          </label>
          <select
            id="create-emp-wh"
            value={values.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
            disabled={isBusy}
            className={selectClass}
            aria-invalid={Boolean(errors.warehouseId)}
          >
            <option value="">{values.role === "TECHNICIAN" ? "اختر المخزن (إلزامي للفني)" : "(بدون تعيين مخزن)"}</option>
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
              جاري الإضافة...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              إضافة الموظف
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
