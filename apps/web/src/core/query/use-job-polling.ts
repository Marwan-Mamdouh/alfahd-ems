"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJobStatus } from "@/core/api/jobs";
import { queryKeys } from "@/core/query/query-keys";
import type { JobStatusResponseDto } from "@/core/api/types";

export interface UseJobPollingOptions {
  jobId: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onSuccess?: (job: JobStatusResponseDto) => void;
  onError?: (error: string) => void;
}

export interface UseJobPollingResult {
  job: JobStatusResponseDto | null;
  status: JobStatusResponseDto["status"] | null;
  isPolling: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  error: string | null;
  refetch: () => void;
  isLoading: boolean;
}

export function useJobPolling({
  jobId,
  enabled = true,
  pollIntervalMs = 2_000,
  timeoutMs = 120_000,
  onSuccess,
  onError,
}: UseJobPollingOptions): UseJobPollingResult {
  const startTimeRef = useRef<number | null>(null);
  const completedHandledRef = useRef<string | null>(null);
  const failedHandledRef = useRef<string | null>(null);

  // Reset tracking timestamps when jobId changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    completedHandledRef.current = null;
    failedHandledRef.current = null;
  }, [jobId]);

  const isEnabled = Boolean(jobId) && enabled;

  const query = useQuery({
    queryKey: queryKeys.jobs.status(jobId ?? ""),
    queryFn: () => fetchJobStatus(jobId!),
    enabled: isEnabled,
    refetchInterval: (q) => {
      if (!isEnabled) return false;

      const data = q.state.data;
      if (data?.status === "COMPLETED" || data?.status === "FAILED") {
        return false;
      }

      const startTime = startTimeRef.current ?? Date.now();
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        return false;
      }

      return pollIntervalMs;
    },
    staleTime: 0,
    gcTime: 60_000,
  });

  const job = query.data ?? null;
  const status = job?.status ?? null;
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const isPolling = isEnabled && (status === "QUEUED" || status === "RUNNING");

  // Handle completion callback once per jobId
  useEffect(() => {
    if (isCompleted && job && completedHandledRef.current !== job.id) {
      completedHandledRef.current = job.id;
      onSuccess?.(job);
    }
  }, [isCompleted, job, onSuccess]);

  // Handle failure callback once per jobId
  useEffect(() => {
    if (isFailed && job && failedHandledRef.current !== job.id) {
      failedHandledRef.current = job.id;
      onError?.(job.error || "Job failed");
    }
  }, [isFailed, job, onError]);

  // Handle polling timeout error
  useEffect(() => {
    if (!isEnabled || isCompleted || isFailed) return;

    const timer = setTimeout(() => {
      if (isPolling) {
        onError?.("Job processing timed out. Please check back later.");
      }
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isEnabled, isCompleted, isFailed, isPolling, timeoutMs, onError]);

  let resolvedError: string | null = null;
  if (isFailed) {
    resolvedError = job?.error || "Job execution failed";
  } else if (query.error) {
    resolvedError =
      query.error instanceof Error ? query.error.message : "Failed to fetch job status";
  }

  return {
    job,
    status,
    isPolling,
    isCompleted,
    isFailed,
    error: resolvedError,
    refetch: () => {
      query.refetch();
    },
    isLoading: query.isLoading,
  };
}
