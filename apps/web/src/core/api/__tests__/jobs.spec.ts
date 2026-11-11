import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchJobStatus,
  fetchIpImportStatus,
  enqueueAttendanceReport,
  enqueueRouterExport,
  uploadIpCsvFile,
  downloadReportFile,
} from "../jobs";
import type { JobStatusResponseDto } from "../types";

describe("Jobs API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("fetchJobStatus and fetchIpImportStatus", () => {
    it("fetches and unwraps job status from /jobs/:id", async () => {
      const mockJob: JobStatusResponseDto = {
        id: "job-abc",
        status: "RUNNING",
        downloadUrl: null,
        error: null,
      };

      let capturedUrl = "";
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        return {
          data: { data: mockJob },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await fetchJobStatus("job-abc");
      expect(capturedUrl).toBe("/jobs/job-abc");
      expect(result).toEqual(mockJob);
    });

    it("fetches status specifically from /ip-addresses/import/:id", async () => {
      const mockJob: JobStatusResponseDto = {
        id: "ip-job-123",
        status: "COMPLETED",
        inserted: 10,
        skipped: 1,
        errors: [],
      };

      let capturedUrl = "";
      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        return {
          data: { data: mockJob },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await fetchIpImportStatus("ip-job-123");
      expect(capturedUrl).toBe("/ip-addresses/import/ip-job-123");
      expect(result).toEqual(mockJob);
    });
  });

  describe("enqueue operations", () => {
    it("enqueues attendance report via GET /attendance/report", async () => {
      let capturedUrl = "";
      let capturedParams: Record<string, unknown> | undefined;

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        capturedParams = config.params as Record<string, unknown> | undefined;
        return {
          data: { data: { jobId: "att-job-1" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await enqueueAttendanceReport({ from: "2026-11-01", to: "2026-11-10" });
      expect(capturedUrl).toBe("/attendance/report");
      expect(capturedParams).toEqual({ from: "2026-11-01", to: "2026-11-10" });
      expect(result).toEqual({ jobId: "att-job-1" });
    });

    it("enqueues router export via POST /routers/export", async () => {
      let capturedUrl = "";
      let capturedData: unknown;

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        capturedData = JSON.parse(String(config.data));
        return {
          data: { data: { jobId: "router-job-1" } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const result = await enqueueRouterExport({ warehouseId: "wh-99" });
      expect(capturedUrl).toBe("/routers/export");
      expect(capturedData).toEqual({ warehouseId: "wh-99" });
      expect(result).toEqual({ jobId: "router-job-1" });
    });

    it("posts file as multipart FormData to /ip-addresses/import", async () => {
      let capturedFormData: FormData | undefined;
      let capturedUrl = "";

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        capturedUrl = config.url ?? "";
        capturedFormData = config.data as FormData;
        return {
          data: { data: { jobId: "enqueued-job-1" } },
          status: 202,
          statusText: "Accepted",
          headers: {},
          config,
        };
      };

      const dummyFile = new File(["address,notes\n192.168.1.1,Gateway"], "ips.csv", {
        type: "text/csv",
      });

      const result = await uploadIpCsvFile(dummyFile);

      expect(capturedUrl).toBe("/ip-addresses/import");
      expect(capturedFormData).toBeInstanceOf(FormData);
      expect(capturedFormData?.get("file")).toBe(dummyFile);
      expect(result).toEqual({ jobId: "enqueued-job-1" });
    });
  });

  describe("downloadReportFile", () => {
    it("downloads blob and triggers browser anchor click for API-relative paths", async () => {
      const mockBlob = new Blob(["excel-content"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: mockBlob,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/mock-uuid");
      const revokeObjectURLMock = vi.fn();
      const clickMock = vi.fn();

      const mockAnchor = {
        href: "",
        download: "",
        click: clickMock,
      };

      const createElementSpy = vi.fn().mockReturnValue(mockAnchor);
      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();

      vi.stubGlobal("window", {
        URL: {
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        },
      });

      vi.stubGlobal("document", {
        createElement: createElementSpy,
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
      });

      await downloadReportFile("job-report-1", "routers-inventory.xlsx");

      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(mockAnchor.download).toBe("routers-inventory.xlsx");
      expect(mockAnchor.href).toBe("blob:http://localhost/mock-uuid");
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-uuid");
    });

    it("handles external provider pre-signed URLs without sending bearer token to external origin", async () => {
      const mockBlob = new Blob(["excel-content"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const externalUrl = "https://storage.googleapis.com/alfahd-reports/signed-report.xlsx";
      const axiosGetSpy = vi.spyOn(axios, "get").mockResolvedValue({
        data: mockBlob,
      } as AxiosResponse);

      const clickMock = vi.fn();
      const mockAnchor = { href: "", download: "", click: clickMock };

      vi.stubGlobal("window", {
        URL: {
          createObjectURL: vi.fn().mockReturnValue("blob:mock"),
          revokeObjectURL: vi.fn(),
        },
      });

      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      });

      await downloadReportFile(externalUrl, "external-report.xlsx");

      // Verifies axios.get was called directly rather than through the authenticated api instance
      expect(axiosGetSpy).toHaveBeenCalledWith(externalUrl, { responseType: "blob" });
      expect(mockAnchor.download).toBe("external-report.xlsx");
    });
  });
});
