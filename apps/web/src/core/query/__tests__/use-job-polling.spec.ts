import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import { fetchJobStatus } from "@/core/api/jobs";
import type { JobStatusResponseDto } from "@/core/api/types";

describe("Job Polling Query Lifecycle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it("fetches job status and updates query cache correctly", async () => {
    const mockRunningJob: JobStatusResponseDto = {
      id: "job-poll-1",
      status: "RUNNING",
      downloadUrl: null,
      error: null,
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockRunningJob },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.jobs.status("job-poll-1");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchJobStatus("job-poll-1"),
    });

    expect(result.id).toBe("job-poll-1");
    expect(result.status).toBe("RUNNING");
    expect(queryClient.getQueryData(key)).toEqual(mockRunningJob);
  });

  it("transitions from RUNNING to COMPLETED and stores outcome payload", async () => {
    const mockCompletedJob: JobStatusResponseDto = {
      id: "job-poll-2",
      status: "COMPLETED",
      downloadUrl: "/jobs/job-poll-2/download",
      error: null,
      inserted: 50,
      skipped: 2,
      errors: [],
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockCompletedJob },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.jobs.status("job-poll-2");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchJobStatus("job-poll-2"),
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.downloadUrl).toBe("/jobs/job-poll-2/download");
    expect(result.inserted).toBe(50);
  });

  it("stores generic error when job status is FAILED", async () => {
    const mockFailedJob: JobStatusResponseDto = {
      id: "job-poll-3",
      status: "FAILED",
      downloadUrl: null,
      error: "Report generation failed",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockFailedJob },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.jobs.status("job-poll-3");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchJobStatus("job-poll-3"),
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("Report generation failed");
  });
});

