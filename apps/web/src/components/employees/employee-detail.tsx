"use client";

import {
  ArrowRight,
  Building2,
  Calendar,
  Camera,
  CreditCard,
  Edit,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { EmployeeStatusBadge } from "./employee-status-badge";
import type { EmployeeRow } from "./types";

interface EmployeeDetailProps {
  employee: EmployeeRow | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onBack?: () => void;
  onEdit?: (employee: EmployeeRow) => void;
  onChangeStatus?: (employee: EmployeeRow) => void;
  onUploadPhoto?: (employee: EmployeeRow) => void;
  canEdit?: boolean;
  canChangeStatus?: boolean;
  canUploadPhoto?: boolean;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  MANAGEMENT: "الإدارة",
  TECHNICAL: "القسم الفني",
  CUSTOMER_SERVICE: "خدمة العملاء",
  WAREHOUSE: "المخازن",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  WAREHOUSE_STAFF: "مسؤول مخزن",
  CS: "خدمة عملاء",
  TECHNICIAN: "فني ميداني",
};

export function EmployeeDetail({
  employee,
  isLoading = false,
  error,
  onRetry,
  onBack,
  onEdit,
  onChangeStatus,
  onUploadPhoto,
  canEdit = true,
  canChangeStatus = true,
  canUploadPhoto = true,
}: EmployeeDetailProps) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (!employee) {
    return (
      <EmptyState
        title="لم يتم العثور على الموظف"
        description="قد يكون تم حذف الحساب أو أن الرابط غير صحيح."
      />
    );
  }

  const deptLabel = employee.department
    ? DEPARTMENT_LABELS[employee.department] ?? employee.department
    : "غير محدد";
  const roleLabel = ROLE_LABELS[employee.role] ?? employee.role;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Navigation */}
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لقائمة الموظفين
        </Button>
      )}

      {/* Header Profile Card */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
            {/* Avatar & Photo button */}
            <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-muted dark:border-slate-800">
              {employee.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.profilePhotoUrl}
                  alt={employee.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <User className="h-10 w-10" />
                </div>
              )}

              {canUploadPhoto && onUploadPhoto && (
                <button
                  type="button"
                  onClick={() => onUploadPhoto(employee)}
                  title="تغيير الصورة الشخصية"
                  aria-label="تغيير الصورة الشخصية"
                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <Camera className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
                <EmployeeStatusBadge status={employee.status} />
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  {roleLabel}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {deptLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(employee)}
                className="gap-1.5"
              >
                <Edit className="h-4 w-4" />
                تعديل البيانات
              </Button>
            )}

            {canChangeStatus && onChangeStatus && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChangeStatus(employee)}
                className="gap-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400"
              >
                <UserCheck className="h-4 w-4" />
                تغيير الحالة
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Contact & Identity Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
            <Mail className="h-4 w-4 text-teal-600" />
            بيانات الاتصال والهوية
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">البريد الإلكتروني:</span>
              <span className="font-medium text-foreground" dir="ltr">
                {employee.email}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                رقم الهاتف:
              </span>
              <span className="font-medium text-foreground" dir="ltr">
                {employee.phone || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                الرقم القومي:
              </span>
              <span className="font-medium text-foreground" dir="ltr">
                {employee.nationalId || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                تاريخ التعيين:
              </span>
              <span className="font-medium text-foreground">
                {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString("ar-EG") : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Organizational & Assignment Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
            <Building2 className="h-4 w-4 text-teal-600" />
            بيانات التعيين والمخزن
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">القسم الإداري:</span>
              <span className="font-medium text-foreground">{deptLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الدور الوظيفي:</span>
              <span className="font-medium text-foreground">{roleLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                المخزن التابع له:
              </span>
              <span className="font-medium text-foreground">
                {employee.warehouseName || "—"}
              </span>
            </div>

            {employee.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">تاريخ إنشاء الحساب:</span>
                <span className="font-medium text-foreground">
                  {new Date(employee.createdAt).toLocaleDateString("ar-EG")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit History Card if available */}
      {employee.statusChanges && employee.statusChanges.length > 0 && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
            <UserCheck className="h-4 w-4 text-teal-600" />
            سجل تدقيق تغييرات الحالة
          </h2>

          <div className="space-y-3">
            {employee.statusChanges.map((change, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {change.from} ← {change.to}
                  </span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-foreground">{change.reason}</span>
                </div>
                <time dateTime={change.changedAt} className="text-muted-foreground" dir="ltr">
                  {new Date(change.changedAt).toLocaleString("ar-EG")}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
