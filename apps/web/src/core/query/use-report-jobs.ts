"use client";

import { useState, useCallback } from "react";
import { Role } from "@alfahd/types";
import { useAuthStore } from "@/core/auth/auth.store";
import {
  enqueueAttendanceReport,
  enqueueRouterExport,
  uploadIpCsvFile,
  downloadReportFile,
} from "@/core/api/jobs";
import { useJobPolling } from "@/core/query/use-job-polling";
import type {
  AttendanceQueryDto,
  RouterReportQueryDto,
  JobStatusResponseDto,
} from "@/core/api/types";

/**
 * Hook for generating and downloading Attendance Excel reports (F2).
 */
export function useAttendanceReport(options?: {
  onSuccess?: (job: JobStatusResponseDto) => void;
  onError?: (error: string) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const userRole = authUser?.role ?? useAuthStore.getState().user?.role;
  const isAdmin = userRole === Role.ADMIN;

  const { job, status, isPolling, isCompleted, isFailed, error } = useJobPolling({
    jobId,
    enabled: Boolean(jobId),
    onSuccess: (completedJob) => {
      options?.onSuccess?.(completedJob);
    },
    onError: (err) => {
      options?.onError?.(err);
    },
  });

  const generateReport = useCallback(
    async (query?: AttendanceQueryDto) => {
      const currentRole = useAuthStore.getState().user?.role;
      if (currentRole !== Role.ADMIN) {
        const msg = "Unauthorized: Only administrators can generate attendance reports";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw new Error(msg);
      }

      try {
        setIsSubmitting(true);
        setSubmitError(null);
        const result = await enqueueAttendanceReport(query);
        setJobId(result.jobId);
        return result.jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to enqueue attendance report";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [options]
  );

  const download = useCallback(
    async (filename = "attendance-report.xlsx") => {
      if (!jobId) return;
      await downloadReportFile(jobId, filename);
    },
    [jobId]
  );

  const reset = useCallback(() => {
    setJobId(null);
    setSubmitError(null);
  }, []);

  return {
    jobId,
    job,
    status,
    isAdmin,
    isGenerating: isSubmitting || isPolling,
    isCompleted,
    isFailed,
    error: submitError || error,
    generateReport,
    download,
    reset,
  };
}

/**
 * Hook for generating and downloading Router Inventory Excel reports (F5).
 */
export function useRouterExport(options?: {
  onSuccess?: (job: JobStatusResponseDto) => void;
  onError?: (error: string) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const userRole = authUser?.role ?? useAuthStore.getState().user?.role;
  const isAdmin = userRole === Role.ADMIN;

  const { job, status, isPolling, isCompleted, isFailed, error } = useJobPolling({
    jobId,
    enabled: Boolean(jobId),
    onSuccess: (completedJob) => {
      options?.onSuccess?.(completedJob);
    },
    onError: (err) => {
      options?.onError?.(err);
    },
  });

  const exportRouters = useCallback(
    async (dto?: RouterReportQueryDto) => {
      const currentRole = useAuthStore.getState().user?.role;
      if (currentRole !== Role.ADMIN) {
        const msg = "Unauthorized: Only administrators can export router inventory";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw new Error(msg);
      }

      try {
        setIsSubmitting(true);
        setSubmitError(null);
        const result = await enqueueRouterExport(dto);
        setJobId(result.jobId);
        return result.jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to enqueue router export";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [options]
  );

  const download = useCallback(
    async (filename = "router-inventory-report.xlsx") => {
      if (!jobId) return;
      await downloadReportFile(jobId, filename);
    },
    [jobId]
  );

  const reset = useCallback(() => {
    setJobId(null);
    setSubmitError(null);
  }, []);

  return {
    jobId,
    job,
    status,
    isAdmin,
    isExporting: isSubmitting || isPolling,
    isCompleted,
    isFailed,
    error: submitError || error,
    exportRouters,
    download,
    reset,
  };
}

/**
 * Hook for bulk IPv4 address CSV upload, background processing, and outcome reporting (F6).
 */
export function useIpImport(options?: {
  onSuccess?: (job: JobStatusResponseDto) => void;
  onError?: (error: string) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const userRole = authUser?.role ?? useAuthStore.getState().user?.role;
  const isAdmin = userRole === Role.ADMIN;

  const { job, status, isPolling, isCompleted, isFailed, error } = useJobPolling({
    jobId,
    enabled: Boolean(jobId),
    onSuccess: (completedJob) => {
      options?.onSuccess?.(completedJob);
    },
    onError: (err) => {
      options?.onError?.(err);
    },
  });

  const importFile = useCallback(
    async (file: File) => {
      const currentRole = useAuthStore.getState().user?.role;
      if (currentRole !== Role.ADMIN) {
        const msg = "Unauthorized: Only administrators can import IP addresses";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw new Error(msg);
      }

      try {
        setIsSubmitting(true);
        setSubmitError(null);
        const result = await uploadIpCsvFile(file);
        setJobId(result.jobId);
        return result.jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to upload IP CSV";
        setSubmitError(msg);
        options?.onError?.(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setJobId(null);
    setSubmitError(null);
  }, []);

  return {
    jobId,
    job,
    status,
    isAdmin,
    isImporting: isSubmitting || isPolling,
    isCompleted,
    isFailed,
    error: submitError || error,
    summary: {
      inserted: job?.inserted ?? 0,
      skipped: job?.skipped ?? 0,
      errors: job?.errors ?? [],
    },
    importFile,
    reset,
  };
}

