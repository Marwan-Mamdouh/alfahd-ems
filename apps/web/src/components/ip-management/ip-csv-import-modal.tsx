"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { IpCsvImportModalProps } from "./types";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
const MAX_ROWS_LIMIT = 5000;

/**
 * Modal dialog for uploading bulk IPv4 CSV files and viewing asynchronous import results.
 * Corresponds to POST /ip-addresses/import and background BullMQ Job status polling.
 */
export function IpCsvImportModal({
  isOpen,
  job,
  onImport,
  onReset,
  onClose,
}: IpCsvImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileValidation = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setClientError("يرجى اختيار ملف بصيغة CSV (.csv) فقط.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setClientError(
        "حجم الملف يتجاوز الحد الأقصى المسموح به (5 ميجابايت). يرجى تقليص حجم الملف."
      );
      return false;
    }
    setClientError(null);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && handleFileValidation(file)) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && handleFileValidation(file)) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || job.kind === "submitting" || job.kind === "polling") {
      return;
    }
    await onImport(selectedFile);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onReset();
  };

  const handleClose = () => {
    if (job.kind === "submitting" || job.kind === "polling") {
      return;
    }
    handleReset();
    onClose();
  };

  // Extract result summary safely from either result object or top-level job fields
  const importResult = job.kind === "complete" ? job.job.result : null;
  const totalProcessed =
    importResult?.total ??
    (job.kind === "complete"
      ? (job.job.inserted ?? 0) + (job.job.skipped ?? 0)
      : 0);
  const totalInserted =
    importResult?.inserted ??
    (job.kind === "complete" ? job.job.inserted ?? 0 : 0);
  const totalSkipped =
    importResult?.skipped ??
    (job.kind === "complete" ? job.job.skipped ?? 0 : 0);
  const errorRows =
    importResult?.errors ??
    (job.kind === "complete" ? job.job.errors ?? [] : []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border bg-card p-6 shadow-xl text-card-foreground overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="csv-import-modal-title"
                className="text-lg font-bold text-foreground"
              >
                استيراد عناوين IPv4 جماعياً (CSV)
              </h2>
              <p className="text-xs text-muted-foreground">
                رفع ملف بيانات لاستيراد وتحديث العناوين في حمام السباحة
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={job.kind === "submitting" || job.kind === "polling"}
            className="h-8 w-8 p-0"
            aria-label="إغلاق النافذة"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Client Validation Error */}
          {clientError && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{clientError}</span>
            </div>
          )}

          {/* ── State: IDLE ────────────────────────────────────────── */}
          {job.kind === "idle" && (
            <>
              {/* Guidance Box */}
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-4 text-xs dark:border-blue-900/50 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
                  <HelpCircle className="h-4 w-4" />
                  <span>إرشادات ومتطلبات ملف الـ CSV:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200/90 leading-relaxed pr-1">
                  <li>
                    الأعمدة المدعومة في السطر الأول:{" "}
                    <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">
                      address
                    </code>{" "}
                    (إلزامي)،{" "}
                    <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">
                      notes
                    </code>{" "}
                    (اختياري).
                  </li>
                  <li>
                    يقبل عناوين IPv4 الفردية فقط (مثل 192.168.1.50). النطاقات وتنسيق CIDR مثل /24 غير مقبولة.
                  </li>
                  <li>
                    الحد الأقصى لحجم الملف: <strong>5 ميجابايت</strong>، والحد الأقصى لعدد الأسطر:{" "}
                    <strong>{MAX_ROWS_LIMIT} سطر</strong>.
                  </li>
                  <li>
                    العناوين المسجلة مسبقاً يتم تخطيها أو تحديث ملاحظاتها وتوثيقها في التقرير.
                  </li>
                </ul>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="اختيار ملف CSV"
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <UploadCloud className="h-6 w-6" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    انقر لاختيار ملف أو اسحب الملف وأفلته هنا
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ملفات CSV فقط بحد أقصى 5 ميجابايت
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs font-mono font-medium text-foreground">
                    <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>{selectedFile.name}</span>
                    <span className="text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── State: SUBMITTING / POLLING ────────────────────────── */}
          {(job.kind === "submitting" || job.kind === "polling") && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">
                  {job.kind === "submitting"
                    ? "جارٍ رفع ومعالجة الملف..."
                    : "جارٍ استيراد السجلات في الخلفية..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {job.kind === "polling"
                    ? `حالة المعالجة: ${job.job.status} (معرّف المهمة: ${job.job.id})`
                    : "يرجى الانتظار حتى يتم إرسال الملف للخادم..."}
                </p>
              </div>
            </div>
          )}

          {/* ── State: COMPLETE ────────────────────────────────────── */}
          {job.kind === "complete" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="text-base font-bold">
                  اكتملت معالجة ملف الاستيراد
                </h3>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-card p-3.5 text-center shadow-2xs">
                  <p className="text-xs text-muted-foreground">إجمالي المعالج</p>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">
                    {totalProcessed}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-3.5 text-center shadow-2xs">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    أُضيفت بنجاح
                  </p>
                  <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                    {totalInserted}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/30 p-3.5 text-center shadow-2xs">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    تم تخطيها / أخطاء
                  </p>
                  <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                    {totalSkipped}
                  </p>
                </div>
              </div>

              {/* Error Rows Table */}
              {errorRows.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>تفاصيل الأسطر التي لم يتم استيرادها ({errorRows.length}):</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border bg-card">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-right font-medium text-muted-foreground">
                          <th className="px-3 py-2 w-16">السطر</th>
                          <th className="px-3 py-2">العنوان</th>
                          <th className="px-3 py-2">سبب الرفض</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {errorRows.map((err, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-1.5 font-mono font-medium text-muted-foreground">
                              #{err.row}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-foreground dir-ltr text-right">
                              {err.address || "—"}
                            </td>
                            <td className="px-3 py-1.5 text-destructive font-medium">
                              {err.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── State: ERROR ───────────────────────────────────────── */}
          {job.kind === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">
                  فشل في عملية الاستيراد
                </p>
                <p className="text-xs text-destructive max-w-md mx-auto">
                  {job.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          {job.kind === "complete" || job.kind === "error" ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="ml-1.5 h-3.5 w-3.5" />
                استيراد ملف آخر
              </Button>
              <Button size="sm" onClick={handleClose}>
                إغلاق
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={job.kind === "submitting" || job.kind === "polling"}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  !selectedFile ||
                  job.kind === "submitting" ||
                  job.kind === "polling"
                }
                className="min-w-[120px]"
              >
                {job.kind === "submitting" || job.kind === "polling" ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ المعالجة...
                  </>
                ) : (
                  <>
                    <UploadCloud className="ml-1.5 h-4 w-4" />
                    بدء الاستيراد
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
