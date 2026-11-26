"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCw,
} from "lucide-react";
import type { RouterReportJobState } from "./types";

export interface RouterReportControlProps {
  /**
   * Current async report generation job state
   */
  job?: RouterReportJobState | null;
  /**
   * Whether current user has permission to export reports
   */
  canExport?: boolean;
  /**
   * Whether trigger request is in-flight
   */
  isExporting?: boolean;
  /**
   * Callback to trigger report export
   */
  onExport?: () => void | Promise<void>;
  /**
   * Callback to dismiss or reset the job status
   */
  onReset?: () => void;
  className?: string;
}

export function RouterReportControl({
  job,
  canExport = true,
  isExporting = false,
  onExport,
  onReset,
  className = "",
}: RouterReportControlProps) {
  const [internalError, setInternalError] = useState<string | null>(null);

  const isPending =
    isExporting || job?.status === "QUEUED" || job?.status === "RUNNING";

  const handleExport = async () => {
    if (!canExport || isPending || !onExport) return;
    setInternalError(null);
    try {
      await onExport();
    } catch (err) {
      setInternalError(
        err instanceof Error ? err.message : "فشلت عملية طلب تصدير التقرير"
      );
    }
  };

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
            تصدير تقارير الأجهزة والراوترات
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            توليد كشوفات تفصيلية للأجهزة والعهد عبر طابور المعالجة المركزي
          </p>
        </div>

        {canExport && (
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || isPending}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-teal-600 bg-background px-3.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40 transition-colors"
            aria-label="تصدير تقرير الراوترات"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            ) : (
              <Download className="h-4 w-4 text-teal-600" />
            )}
            <span>{isPending ? "جاري التجهيز..." : "تصدير التقرير"}</span>
          </button>
        )}
      </div>

      {/* Permission Warning if not allowed */}
      {!canExport && (
        <p className="text-xs text-muted-foreground italic">
          ليس لديك الصلاحيات الكافية لتصدير تقارير أجهزة الراوتر.
        </p>
      )}

      {/* Internal Trigger Error */}
      {internalError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{internalError}</span>
        </div>
      )}

      {/* Job Status Banner */}
      {job && (
        <div
          aria-live="polite"
          className="rounded-xl border bg-card p-4 text-xs shadow-sm space-y-3"
        >
          {/* QUEUED */}
          {job.status === "QUEUED" && (
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
              <Clock className="h-5 w-5 shrink-0 animate-pulse" />
              <div>
                <p className="font-semibold">طلب التصدير في طابور المعالجة (QUEUED)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  تم إرسال الطلب لخادم المعالجة وبانتظار بدء التوليد.
                </p>
              </div>
            </div>
          )}

          {/* RUNNING */}
          {job.status === "RUNNING" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-teal-700 dark:text-teal-300">
                <span className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  جاري تجهيز التقرير (RUNNING)...
                </span>
                <span className="font-mono text-xs font-bold" dir="ltr">
                  {typeof job.progress === "number" ? `${job.progress}%` : ""}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-teal-600 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(Math.max(job.progress ?? 20, 5), 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* COMPLETED */}
          {job.status === "COMPLETED" && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">تم تجهيز التقرير بنجاح (COMPLETED)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    التقرير جاهز للتحميل المباشر.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    download
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تحميل التقرير
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                    title="الرابط غير متوفر من الخادم"
                  >
                    <Download className="h-3.5 w-3.5" />
                    الرابط غير متوفر
                  </button>
                )}

                {onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium hover:bg-muted text-muted-foreground"
                    title="إغلاق التنبيه"
                  >
                    إغلاق
                  </button>
                )}
              </div>
            </div>
          )}

          {/* FAILED */}
          {job.status === "FAILED" && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <p className="font-semibold">فشل تجهيز التقرير (FAILED)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {job.error || "حدث خطأ غير متوقع أثناء معالجة التقرير."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onExport && (
                  <button
                    type="button"
                    onClick={handleExport}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    إعادة المحاولة
                  </button>
                )}
                {onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium hover:bg-muted text-muted-foreground"
                  >
                    إغلاق
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
