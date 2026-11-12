"use client";

import React, { useState } from "react";
import { Loader2, Download, AlertCircle, CheckCircle2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Role } from "@alfahd/types";
import { useAuthStore } from "@/core/auth/auth.store";
import { CsvDropzone } from "@/components/shared/csv/csv-dropzone";
import { ImportSummary } from "@/components/shared/csv/import-summary";
import { useJobPolling } from "@/core/query/use-job-polling";
import { uploadCsvFile, downloadReportFile } from "@/core/api/jobs";
import type { JobStatusResponseDto } from "@/core/api/types";

export type JobDialogMode = "import" | "export";

export interface JobProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: JobDialogMode;
  title: string;
  description?: string;
  uploadEndpoint?: string;
  requiredCsvHeaders?: string[];
  initialJobId?: string | null;
  downloadFilename?: string;
  onJobComplete?: (job: JobStatusResponseDto) => void;
}

export function JobProgressDialog({
  open,
  onOpenChange,
  mode = "import",
  title,
  description,
  uploadEndpoint,
  requiredCsvHeaders,
  initialJobId = null,
  downloadFilename = "report.xlsx",
  onJobComplete,
}: JobProgressDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedJobId, setUploadedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const authUser = useAuthStore((s) => s.user);
  const userRole = authUser?.role ?? useAuthStore.getState().user?.role;
  const isAdmin = userRole === Role.ADMIN;

  const activeJobId = uploadedJobId ?? initialJobId;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedFile(null);
      setUploadedJobId(null);
      setIsSubmitting(false);
      setSubmitError(null);
      setIsDownloading(false);
    }
    onOpenChange(nextOpen);
  };

  const { job, status, isPolling, isCompleted, isFailed, error } = useJobPolling({
    jobId: activeJobId,
    enabled: open && Boolean(activeJobId),
    onSuccess: (completedJob) => {
      onJobComplete?.(completedJob);
    },
  });

  const handleStartUpload = async () => {
    if (!selectedFile || !uploadEndpoint) return;

    const currentRole = useAuthStore.getState().user?.role;
    if (currentRole !== Role.ADMIN) {
      setSubmitError("Unauthorized: Only administrators can trigger imports");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const result = await uploadCsvFile(uploadEndpoint, selectedFile);
      setUploadedJobId(result.jobId);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to upload and enqueue import job"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!activeJobId) return;
    try {
      setIsDownloading(true);
      await downloadReportFile(activeJobId, downloadFilename);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadedJobId(null);
    setSubmitError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="job-progress-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* STEP 1: File selection for import mode when no job is active */}
          {mode === "import" && !activeJobId && (
            <div className="space-y-4">
              {!isAdmin && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>عذراً، عمليات الاستيراد والتقارير مقتصرة على مديري النظام فقط (ADMIN).</span>
                </div>
              )}
              <CsvDropzone
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
                requiredHeaders={requiredCsvHeaders}
                disabled={isSubmitting || !isAdmin}
              />
              {submitError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Job Active / Polling state */}
          {isPolling && (
            <div
              className="flex flex-col items-center justify-center p-8 text-center space-y-3"
              data-testid="job-polling-state"
            >
              <div className="relative flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary">
                <Loader2 className="size-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {status === "QUEUED" ? "Waiting in background queue..." : "Processing job..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take a few moments. Please keep this window open.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Job Completed */}
          {isCompleted && (
            <div className="space-y-4" data-testid="job-completed-state">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="size-5 shrink-0" />
                <span>
                  {mode === "export"
                    ? "Report generated successfully!"
                    : "Import processed successfully!"}
                </span>
              </div>

              {mode === "import" && job && (
                <ImportSummary
                  inserted={job.inserted}
                  skipped={job.skipped}
                  errors={job.errors}
                />
              )}

              {mode === "export" && (
                <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your Excel report has been prepared and is ready for download.
                  </p>
                  <Button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="gap-2"
                    data-testid="download-report-btn"
                  >
                    {isDownloading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    <span>Download Report (.xlsx)</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Job Failed */}
          {isFailed && (
            <div
              className="flex items-start gap-3 p-4 text-sm text-destructive rounded-xl bg-destructive/10 border border-destructive/20"
              data-testid="job-failed-state"
            >
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Operation failed</p>
                <p className="text-xs text-destructive/90">{error || "The background job encountered an error."}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "import" && !activeJobId && (
            <Button
              type="button"
              onClick={handleStartUpload}
              disabled={!selectedFile || isSubmitting || !isAdmin}
              className="gap-2"
              data-testid="start-import-btn"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              <span>Upload & Import</span>
            </Button>
          )}

          {isFailed && mode === "import" && (
            <Button type="button" variant="outline" onClick={handleReset}>
              Try Again
            </Button>
          )}

          {(isCompleted || isFailed || (!activeJobId && mode === "import")) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPolling}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
