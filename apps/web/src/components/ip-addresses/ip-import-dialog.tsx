"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Clock,
  Hourglass,
  Download,
  X,
} from "lucide-react";
import type { IpImportResultDto, JobStatusResponseDto } from "@alfahd/types";
import { Button } from "@/components/ui/button";
import { CsvDropzone } from "@/components/shared/csv/csv-dropzone";

export const IP_CSV_SAMPLE = `address,notes
192.0.2.1,Example address
192.0.2.2,
`;

export interface IpImportErrorItem {
  row?: number;
  address?: string;
  reason?: string;
}

export interface IpImportResultLike {
  total?: number;
  inserted?: number;
  skipped?: number;
  errors?: IpImportErrorItem[];
}

export interface IpImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void> | void;
  jobStatus?: JobStatusResponseDto["status"] | null;
  isSubmitting?: boolean;
  isTimedOut?: boolean;
  errorMessage?: string | null;
  result?: IpImportResultLike | IpImportResultDto | null;
  onRetryPolling?: () => void;
  onReset?: () => void;
}

export function IpImportDialog({
  isOpen,
  onClose,
  onImport,
  jobStatus = null,
  isSubmitting = false,
  isTimedOut = false,
  errorMessage = null,
  result = null,
  onRetryPolling,
  onReset,
}: IpImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  if (!isOpen) return null;

  const isQueued = jobStatus === "QUEUED";
  const isRunning = jobStatus === "RUNNING";
  const isCompleted = jobStatus === "COMPLETED";
  const isFailed = jobStatus === "FAILED";
  const isUploading = (isSubmitting || localSubmitting) && !isQueued && !isRunning && !isCompleted && !isFailed;
  const isBusy = isUploading || isQueued || isRunning;

  const safeInserted = typeof result?.inserted === "number" ? result.inserted : 0;
  const safeSkipped = typeof result?.skipped === "number" ? result.skipped : 0;
  const safeErrors: IpImportErrorItem[] = Array.isArray(result?.errors) ? result.errors : [];
  const hasExplicitTotal = typeof result?.total === "number";

  const handleClose = () => {
    if (isBusy && !isTimedOut) return;
    setFile(null);
    onReset?.();
    onClose();
  };

  const handleStartImport = async () => {
    if (!file || isBusy || isTimedOut) return;
    try {
      setLocalSubmitting(true);
      await onImport(file);
    } catch {
      // Handled via errorMessage prop
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    onReset?.();
  };

  const handleDownloadSample = () => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([IP_CSV_SAMPLE], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ip-import-sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
      data-testid="ip-import-dialog"
    >
      <div className="relative max-h-[90vh] w-full max-w-[580px] overflow-hidden flex flex-col rounded-2xl border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ip-import-title" className="text-lg font-bold text-foreground">
                استيراد عناوين IP من ملف CSV
              </h2>
              <p className="text-xs text-muted-foreground">
                رفع ملف CSV يحتوي على قائمة عناوين IPv4 لإضافتها جماعياً إلى السجل المركزي.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isBusy && !isTimedOut}
            onClick={handleClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground"
            data-testid="ip-import-close-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4">
          {!isCompleted && !isFailed && (
            <>
              <CsvDropzone
                selectedFile={file}
                onFileSelect={setFile}
                requiredHeaders={["address"]}
                disabled={isBusy}
                helperText="ملف CSV بترميز UTF-8، حد أقصى 5 ميجابايت و5,000 سطر بيانات غير فارغ (الترويسات المعتمدة: address, notes)"
              />

              {/* Approved Headers, Limits, Sample CSV, and Parser Limitations */}
              <div
                className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-2.5 text-muted-foreground"
                data-testid="ip-csv-guidance"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet className="size-4 text-teal-600" />
                    <span>مواصفات ملف CSV وقيود المعالج:</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleDownloadSample}
                    className="gap-1 text-[11px]"
                    data-testid="ip-csv-sample-download-btn"
                  >
                    <Download className="size-3" />
                    <span>تحميل نموذج CSV</span>
                  </Button>
                </div>

                <ul className="list-disc list-inside space-y-1 pr-1 text-[11px] leading-relaxed">
                  <li>
                    <strong className="text-foreground">الحدود المعتمدة:</strong> حد أقصى{" "}
                    <span className="font-semibold text-foreground">5 MiB (5 ميجابايت)</span> للحجم و{" "}
                    <span className="font-semibold text-foreground">5,000 سطر بيانات غير فارغ</span>.
                  </li>
                  <li>
                    <strong className="text-foreground">الأعمدة المعتمدة:</strong>{" "}
                    <code className="font-mono text-foreground">address</code> (إلزامي، عنوان IPv4 فردي فقط — لا يُقبل CIDR أو IPv6) و{" "}
                    <code className="font-mono text-foreground">notes</code> (اختياري). يتم تجاهل أي أعمدة أخرى.
                  </li>
                  <li>
                    <strong className="text-foreground">الترميز والفاصل:</strong> UTF-8 (يتم تجاهل علامة UTF-8 BOM تلقائياً) باستخدام الفاصلة الإنجليزية{" "}
                    <code className="font-mono text-foreground">,</code> كفاصل بين الأعمدة.
                  </li>
                  <li>
                    <strong className="text-foreground">قيود المحلل (Parser Limitations):</strong> يتم تقليم المسافات وإزالة علامات الاقتباس المحيطة ببداية ونهاية الحقل فقط؛{" "}
                    <span className="text-foreground font-medium">
                      لا يدعم المحلل الحقول المقتبسة التي تحتوي على فواصل (,) أو أسطر جديدة متعددة الأسطر داخل الاقتباس
                    </span>
                    .
                  </li>
                  <li>
                    <strong className="text-foreground">الأسطر الفارغة وأرقام الأخطاء:</strong> يتم تجاهل الأسطر الفارغة عند الاحتساب، وتُرجَع أرقام الأخطاء وفق{" "}
                    <span className="text-foreground font-medium">رقم السطر الفعلي في الملف الأصلي</span> شاملاً الترويسة والأسطر الفارغة، بينما تُتخطى العناوين المكررة تلقائياً.
                  </li>
                </ul>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">مثال CSV صالح:</p>
                  <pre
                    dir="ltr"
                    className="rounded-lg border border-border bg-background p-2.5 font-mono text-[11px] text-foreground text-left overflow-x-auto"
                    data-testid="ip-csv-sample"
                  >
                    {IP_CSV_SAMPLE.trim()}
                  </pre>
                </div>
              </div>

              {/* Submitting / Uploading (before BullMQ state is returned) */}
              {isUploading && (
                <div
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-teal-500/20 bg-teal-500/5 text-center space-y-2"
                  data-testid="ip-import-submitting"
                >
                  <Loader2 className="size-7 animate-spin text-teal-600 dark:text-teal-400" />
                  <p className="text-sm font-medium text-foreground">
                    جاري رفع ملف CSV وإرسال طلب الاستيراد...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    يتم تسليم الملف إلى الخادم لبدء المعالجة في الخلفية.
                  </p>
                </div>
              )}

              {/* QUEUED State */}
              {isQueued && !isTimedOut && (
                <div
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-center space-y-2"
                  data-testid="ip-import-queued"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Hourglass className="size-5" />
                  </div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    في قائمة الانتظار (QUEUED)
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    تم قبول الملف ووضعه في طابور المعالجة بالخلفية بانتظار بدء العامل (Worker).
                  </p>
                </div>
              )}

              {/* RUNNING State */}
              {isRunning && !isTimedOut && (
                <div
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-teal-500/25 bg-teal-500/10 text-center space-y-2"
                  data-testid="ip-import-running"
                >
                  <Loader2 className="size-8 animate-spin text-teal-600 dark:text-teal-400" />
                  <p className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                    جاري التنفيذ والمعالجة (RUNNING)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    يتم الآن فحص عناوين IPv4 وتخطي المكررات وتسجيل العناوين الصالحة في قاعدة البيانات.
                  </p>
                </div>
              )}

              {/* Recoverable Timeout State */}
              {isTimedOut && (
                <div
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200"
                  data-testid="ip-import-timeout"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>استغرقت معالجة ملف CSV وقتاً أطول من المتوقع (120 ثانية).</span>
                  </div>
                  <p className="text-muted-foreground">
                    قد تكون العملية ما زالت قيد المعالجة في الخادم. يمكنك الاستمرار في التحقق من الحالة دون الحاجة لإعادة رفع الملف مرة أخرى.
                  </p>
                  {onRetryPolling && (
                    <div className="pt-1 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={onRetryPolling}
                        className="bg-amber-600 text-white hover:bg-amber-700 text-xs"
                        data-testid="ip-import-retry-btn"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>إعادة التحقق من الحالة</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Submission / Polling Error */}
              {errorMessage && !isBusy && !isTimedOut && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                  data-testid="ip-import-error"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}

          {/* COMPLETED Terminal Success State */}
          {isCompleted && (
            <div className="space-y-4" data-testid="ip-import-completed">
              <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>اكتملت معالجة ملف CSV بنجاح (COMPLETED)</span>
              </div>

              {/* RTL-friendly Result Summary */}
              <div className="space-y-3" data-testid="ip-import-results">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  {/* Inserted */}
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400"
                    data-testid="ip-import-stat-inserted"
                  >
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <CheckCircle2 className="size-3.5" />
                      <span>تمت إضافتها</span>
                    </div>
                    <span className="mt-1 text-xl font-bold">{safeInserted}</span>
                  </div>

                  {/* Skipped */}
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400"
                    data-testid="ip-import-stat-skipped"
                  >
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <AlertTriangle className="size-3.5" />
                      <span>تم تخطيها</span>
                    </div>
                    <span className="mt-1 text-xl font-bold">{safeSkipped}</span>
                  </div>

                  {/* Errors */}
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 ${
                      safeErrors.length > 0
                        ? "border-destructive/20 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                    data-testid="ip-import-stat-errors"
                  >
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <XCircle className="size-3.5" />
                      <span>أخطاء</span>
                    </div>
                    <span className="mt-1 text-xl font-bold">{safeErrors.length}</span>
                  </div>
                </div>

                {hasExplicitTotal && (
                  <p
                    className="text-xs text-muted-foreground text-center"
                    data-testid="ip-import-total-count"
                  >
                    إجمالي صفوف البيانات غير الفارغة (total):{" "}
                    <span className="font-semibold text-foreground">{result?.total}</span>
                  </p>
                )}

                {/* Row-level errors with physical CSV line numbers */}
                {safeErrors.length > 0 && (
                  <div
                    className="overflow-hidden rounded-xl border border-border text-xs"
                    data-testid="ip-import-errors-container"
                  >
                    <div className="bg-muted/40 px-3 py-2 font-semibold text-destructive text-right border-b border-border">
                      تفاصيل أخطاء الصفوف ({safeErrors.length})
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <table
                        className="w-full text-right border-collapse"
                        data-testid="ip-import-errors-table"
                      >
                        <thead className="bg-muted/50 text-muted-foreground font-medium sticky top-0">
                          <tr>
                            <th className="py-2 px-3 w-24 text-right">رقم السطر</th>
                            <th className="py-2 px-3 text-right">العنوان</th>
                            <th className="py-2 px-3 text-right">السبب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {safeErrors.map((err, index) => (
                            <tr
                              key={`${err.row ?? "unknown"}-${err.address ?? "empty"}-${index}`}
                              className="hover:bg-muted/20"
                            >
                              <td className="py-1.5 px-3 font-mono text-muted-foreground">
                                {typeof err.row === "number" ? `#${err.row}` : "—"}
                              </td>
                              <td
                                className="py-1.5 px-3 font-mono font-medium dir-ltr text-right truncate max-w-[150px]"
                                title={err.address ?? ""}
                              >
                                {err.address || "—"}
                              </td>
                              <td className="py-1.5 px-3 text-destructive/90">
                                {err.reason || "خطأ غير محدد"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FAILED Terminal Error State */}
          {isFailed && (
            <div className="space-y-4" data-testid="ip-import-failed">
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-medium"
              >
                <XCircle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">فشلت معالجة ملف الاستيراد (FAILED)</p>
                  <p className="text-destructive/90 font-normal">
                    {errorMessage || "تعذرت معالجة مهمة الاستيراد في الخادم."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between shrink-0">
          <div>
            {(isCompleted || isFailed || isTimedOut) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="h-9 px-3 text-xs"
                data-testid="ip-import-reset-btn"
              >
                <RotateCcw className="size-3.5" />
                <span>استيراد ملف آخر</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isBusy && !isTimedOut}
              className="h-9 px-4 text-xs"
              data-testid="ip-import-cancel-btn"
            >
              {isCompleted ? "تم" : "إلغاء"}
            </Button>

            {!isCompleted && !isFailed && (
              <Button
                type="button"
                onClick={handleStartImport}
                disabled={!file || isBusy || isTimedOut}
                className="h-9 px-5 bg-teal-600 text-xs text-white hover:bg-teal-700"
                data-testid="ip-import-submit-btn"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{isQueued ? "في الانتظار..." : "جاري الاستيراد..."}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-3.5" />
                    <span>بدء الاستيراد</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
