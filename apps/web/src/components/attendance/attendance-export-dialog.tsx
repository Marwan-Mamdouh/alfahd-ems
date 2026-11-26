"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import type { Department } from "@alfahd/types";
import type { Job, ReportExportFormData } from "./types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ATTENDANCE_DEPARTMENTS } from "./attendance-filters";

export interface AttendanceExportDialogProps {
  isOpen: boolean;
  job?: Job;
  onClose: () => void;
  onRequestExport: (params: ReportExportFormData) => Promise<void> | void;
  onDownload?: (jobId: string, url: string) => void;
  onReset?: () => void;
}

export function AttendanceExportDialog({
  isOpen,
  job = { kind: "idle" },
  onClose,
  onRequestExport,
  onDownload,
  onReset,
}: AttendanceExportDialogProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  if (!isOpen) return null;

  const isIdle = job.kind === "idle";
  const isSubmitting = job.kind === "submitting" || isSubmittingLocal;
  const isPolling = job.kind === "polling";
  const isComplete = job.kind === "complete";
  const isError = job.kind === "error";

  const handleStartExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!from || !to) {
      setValidationError("تاريخ البداية وتاريخ النهاية كلاهما مطلوب لاستخراج التقرير.");
      return;
    }

    if (from > to) {
      setValidationError("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.");
      return;
    }

    // Range must not exceed 366 days (per contract: DATE_RANGE_EXCEEDS_MAXIMUM)
    const startDate = new Date(from);
    const endDate = new Date(to);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      setValidationError("فترة التقرير لا يمكن أن تتجاوز 366 يوماً (سنة كحد أقصى).");
      return;
    }

    const payload: ReportExportFormData = {
      from,
      to,
      department: department ? (department as Department) : undefined,
    };

    try {
      setIsSubmittingLocal(true);
      await onRequestExport(payload);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "فشل إرسال طلب التقرير.");
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const handleDownload = () => {
    if (job.kind === "complete" && job.job.downloadUrl) {
      if (onDownload) {
        onDownload(job.job.id, job.job.downloadUrl);
      } else {
        window.open(job.job.downloadUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleResetForm = () => {
    setValidationError(null);
    onReset?.();
  };

  const handleClose = () => {
    if (!isSubmitting && !isPolling) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
      data-testid="attendance-export-dialog"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="export-dialog-title" className="text-lg font-bold text-foreground">
                تصدير تقرير الحضور والانصراف
              </h2>
              <p className="text-xs text-muted-foreground">
                توليد ملف Excel شامل لسجلات الحضور ضمن النطاق الزمني المحدد.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting || isPolling}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* STEP 1: Form (when Idle) */}
          {isIdle && (
            <form onSubmit={handleStartExport} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="export-from" className="text-xs font-medium">
                    من تاريخ <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="export-from"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="export-from-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="export-to" className="text-xs font-medium">
                    إلى تاريخ <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="export-to"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="export-to-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="export-department" className="text-xs font-medium">
                  القسم (اختياري)
                </Label>
                <select
                  id="export-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department | "")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="export-department-select"
                >
                  <option value="">جميع الأقسام</option>
                  {ATTENDANCE_DEPARTMENTS.map((dept) => (
                    <option key={dept.value} value={dept.value}>
                      {dept.label}
                    </option>
                  ))}
                </select>
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  data-testid="export-validation-error"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="export-cancel-btn"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                  data-testid="export-submit-btn"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>طلب التقرير</span>
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Submitting or Polling */}
          {(isSubmitting || isPolling) && (
            <div
              className="flex flex-col items-center justify-center p-6 text-center space-y-3"
              data-testid="export-polling-state"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {isSubmitting
                    ? "جارٍ إرسال طلب التقرير..."
                    : job.kind === "polling" && job.job.status === "QUEUED"
                      ? "الطلب في قائمة الانتظار بالخلفية..."
                      : "جارٍ تجميع وتوليد بيانات التقرير..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  يتم معالجة التقرير كعملية غير متزامنة لضمان استقرار النظام.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Complete */}
          {isComplete && (
            <div
              className="flex flex-col items-center justify-center p-6 text-center space-y-4"
              data-testid="export-completed-state"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">
                  تم إنشاء التقرير بنجاح!
                </p>
                <p className="text-xs text-muted-foreground">
                  الملف جاهز الآن للتحميل بتنسيق جدول بيانات Excel (.xlsx).
                </p>
              </div>

              {job.job.downloadUrl ? (
                <Button
                  type="button"
                  onClick={handleDownload}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  data-testid="export-download-btn"
                >
                  <Download className="h-4 w-4" />
                  <span>تحميل التقرير (.xlsx)</span>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground border p-2 rounded-lg bg-muted/40">
                  التقرير اكتمل ولكن لم يُرفق رابط تنزيل مباشر من الخادم.
                </p>
              )}

              <div className="w-full border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-full"
                  data-testid="export-close-btn"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Error */}
          {isError && (
            <div
              className="space-y-4 p-2 text-center"
              data-testid="export-failed-state"
            >
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 text-right">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">فشل إنشاء التقرير</p>
                  <p className="mt-0.5">{job.message}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetForm}
                  data-testid="export-retry-btn"
                >
                  المحاولة مجدداً
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
