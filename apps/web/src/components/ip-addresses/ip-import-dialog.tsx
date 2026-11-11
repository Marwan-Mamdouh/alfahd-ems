"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";
import { CsvDropzone } from "@/components/shared/csv/csv-dropzone";
import { ImportSummary } from "@/components/shared/csv/import-summary";
import { useIpImport } from "@/core/query/use-report-jobs";

export interface IpImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IpImportDialog({
  isOpen,
  onClose,
  onSuccess,
}: IpImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);

  const {
    isImporting,
    isCompleted,
    isFailed,
    error,
    summary,
    importFile,
    reset,
  } = useIpImport({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isImporting) {
      setFile(null);
      reset();
      onClose();
    }
  };

  const handleStartImport = async () => {
    if (!file) return;
    try {
      await importFile(file);
    } catch {
      // Handled by hook
    }
  };

  const handleReset = () => {
    setFile(null);
    reset();
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
      <div className="relative max-h-[90vh] w-full max-w-[540px] overflow-hidden flex flex-col rounded-2xl border bg-card p-6 shadow-2xl">
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

          <button
            type="button"
            disabled={isImporting}
            onClick={handleClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4">
          {!isCompleted && !isFailed && (
            <>
              <CsvDropzone
                selectedFile={file}
                onFileSelect={setFile}
                disabled={isImporting}
                helperText="ملف CSV بحجم أقصى 5 ميجابايت (الترويسات المقبولة: address, notes)"
              />

              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="size-4 text-teal-600" />
                  <span>تنسيق ملف CSV المطلوب:</span>
                </div>
                <p>يجب أن يتضمن الملف العمودين التاليين:</p>
                <ul className="list-disc list-inside space-y-0.5 pr-2 font-mono text-[11px]">
                  <li>address: عنوان IPv4 الفردي (إلزامي، مثال: 10.0.0.1)</li>
                  <li>notes: الملاحظات الخاصة بالعنوان (اختياري)</li>
                </ul>
              </div>

              {isImporting && (
                <div
                  className="flex flex-col items-center justify-center p-6 rounded-xl border border-teal-500/20 bg-teal-500/5 text-center space-y-2"
                  data-testid="ip-import-loading"
                >
                  <Loader2 className="size-8 animate-spin text-teal-600 dark:text-teal-400" />
                  <p className="text-sm font-medium text-foreground">
                    جاري رفع الملف ومعالجة العناوين في الخلفية...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    يتم التحقق من صحة العناوين وتخطي العناوين المكررة تلقائياً.
                  </p>
                </div>
              )}

              {error && !isImporting && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {isCompleted && (
            <div className="space-y-4" data-testid="ip-import-completed">
              <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>اكتملت معالجة ملف CSV بنجاح!</span>
              </div>

              <ImportSummary
                inserted={summary.inserted}
                skipped={summary.skipped}
                errors={summary.errors}
              />
            </div>
          )}

          {isFailed && (
            <div className="space-y-4" data-testid="ip-import-failed">
              <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-medium">
                <AlertTriangle className="size-4 shrink-0" />
                <span>فشلت معالجة ملف الاستيراد: {error || "خطأ غير معروف"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between shrink-0">
          <div>
            {(isCompleted || isFailed) && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors"
                data-testid="ip-import-reset-btn"
              >
                <RotateCcw className="size-3.5" />
                استيراد ملف آخر
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {isCompleted ? "تم" : "إلغاء"}
            </button>

            {!isCompleted && !isFailed && (
              <button
                type="button"
                onClick={handleStartImport}
                disabled={!file || isImporting}
                className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-teal-600 text-xs font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                data-testid="ip-import-submit-btn"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    جاري الاستيراد...
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-3.5" />
                    بدء الاستيراد
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
