"use client";

import { useState, type FormEvent } from "react";
import { Info, Loader2, ShieldAlert, UserCheck, X } from "lucide-react";
import type { UserStatus } from "@alfahd/types";

import { Button } from "@/components/ui/button";
import type { EmployeeRow } from "./types";
import {
  EmployeeStatusBadge,
  EMPLOYEE_STATUS_OPTIONS,
  getEmployeeStatusLabel,
} from "./employee-status-badge";

interface EmployeeStatusDialogProps {
  employee: EmployeeRow | null;
  isOpen: boolean;
  initialNewStatus?: UserStatus;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (status: UserStatus, reason: string) => Promise<void> | void;
}

export function EmployeeStatusDialog({
  employee,
  isOpen,
  initialNewStatus,
  isSubmitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: EmployeeStatusDialogProps) {
  const getInitialStatus = (): UserStatus => {
    if (initialNewStatus) return initialNewStatus;
    if (!employee) return "ACTIVE";
    return employee.status === "ACTIVE" ? "ON_LEAVE" : "ACTIVE";
  };

  const [newStatus, setNewStatus] = useState<UserStatus>(getInitialStatus);
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [prevEmployeeId, setPrevEmployeeId] = useState<string | null>(employee?.id ?? null);

  // Sync state during render when employee identity changes (React recommended pattern)
  if (employee && employee.id !== prevEmployeeId) {
    setPrevEmployeeId(employee.id);
    setNewStatus(initialNewStatus ?? (employee.status === "ACTIVE" ? "ON_LEAVE" : "ACTIVE"));
    setReason("");
    setValidationError(null);
  }

  if (!isOpen || !employee) return null;

  const isBusy = isSubmitting || localSubmitting;
  const isInactive = newStatus === "INACTIVE";
  const isSameStatus = newStatus === employee.status;

  const handleClose = () => {
    setReason("");
    setValidationError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isBusy) return;

    if (isSameStatus) {
      setValidationError("يرجى اختيار حالة مختلفة عن الحالة الحالية للموظف.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setValidationError("سبب تغيير الحالة إلزامي لتوثيق سجل التدقيق والرقابة.");
      return;
    }

    if (trimmedReason.length < 3) {
      setValidationError("يرجى كتابة سبب مفصل لتغيير الحالة (3 أحرف على الأقل).");
      return;
    }

    try {
      setLocalSubmitting(true);
      setValidationError(null);
      await onSubmit(newStatus, trimmedReason);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "حدث خطأ أثناء تحديث حالة الموظف.");
    } finally {
      setLocalSubmitting(false);
    }
  };

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
        <button
          type="button"
          onClick={handleClose}
          disabled={isBusy}
          aria-label="إغلاق"
          className="absolute left-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 id="status-dialog-title" className="text-lg font-bold text-foreground">
              تغيير حالة الموظف
            </h3>
            <p className="text-xs text-muted-foreground">
              تعديل الحالة التشغيلية مع تسجيل سبب التدقيق الأمني الإلزامي.
            </p>
          </div>
        </div>

        {/* Current Employee Info */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{employee.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">الحالة الحالية:</span>
              <EmployeeStatusBadge status={employee.status} />
            </div>
          </div>
          <div className="mt-1 text-muted-foreground" dir="ltr">
            {employee.email}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Status Selection */}
          <div>
            <label htmlFor="new-status-select" className="mb-1.5 block text-sm font-medium text-foreground">
              الحالة الجديدة <span className="text-destructive">*</span>
            </label>
            <select
              id="new-status-select"
              value={newStatus}
              onChange={(e) => {
                setNewStatus(e.target.value as UserStatus);
                setValidationError(null);
              }}
              disabled={isBusy}
              className={selectClass}
            >
              {EMPLOYEE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {opt.value === employee.status ? "(الحالية)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Consequence Banner */}
          {isInactive && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <strong className="block font-semibold">
                  تحذير أمني: إنهاء الجلسات النشطة (Revoke Active Sessions)
                </strong>
                عند تحويل الموظف إلى «غير نشط»، سيقوم النظام فوراً بإلغاء كافة الرموز المميزة (Refresh
                Tokens) المسجلة في Redis وطرد الموظف من أي جلسة مفتوحة ومنعه من تسجيل الدخول.
              </div>
            </div>
          )}

          {newStatus === "ON_LEAVE" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <strong className="block font-semibold">إجازة رسمية (ON_LEAVE)</strong>
                يتم تعليق إسناد المهام وجداول العمل مؤقتاً، مع بقاء صلاحيات الحساب والجلسات دون إنهاء قسري.
              </div>
            </div>
          )}

          {newStatus === "ACTIVE" && employee.status !== "ACTIVE" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <div>
                <strong className="block font-semibold">تفعيل الحساب (ACTIVE)</strong>
                سيتم استئناف الصلاحيات الكاملة وتمكين الموظف من تسجيل الدخول والعمل في النظام.
              </div>
            </div>
          )}

          {/* Mandatory Reason */}
          <div>
            <label htmlFor="status-reason-input" className="mb-1.5 block text-sm font-medium text-foreground">
              سبب تغيير الحالة <span className="text-destructive">*</span>
            </label>
            <textarea
              id="status-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setValidationError(null);
              }}
              placeholder="يرجى كتابة سبب توثيقي مفصل (مثال: انتهاء فترة الإجازة، استقالة رسمية، إلخ)..."
              disabled={isBusy}
              required
              className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-invalid={Boolean(validationError)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              * هذا السبب إلزامي طبقاً لسياسات تدقيق وتوثيق تغييرات الموظفين (Audit History).
            </p>
          </div>

          {(validationError || errorMessage) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {validationError || errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" disabled={isBusy} onClick={handleClose}>
              إلغاء
            </Button>

            <Button
              type="submit"
              disabled={isBusy || isSameStatus || !reason.trim()}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  تأكيد التغيير إلى {getEmployeeStatusLabel(newStatus)}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
