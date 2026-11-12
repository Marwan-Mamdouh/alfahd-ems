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
  parseContentDispositionFilename,
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
    it("uses filename from Content-Disposition header when present on server response", async () => {
      const mockBlob = new Blob(["excel-content"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: mockBlob,
          status: 200,
          statusText: "OK",
          headers: {
            "content-disposition": 'attachment; filename="server-attendance-2026.xlsx"',
          },
          config,
        };
      };

      const clickMock = vi.fn();
      const mockAnchor = { href: "", download: "", click: clickMock };

      vi.stubGlobal("window", {
        URL: {
          createObjectURL: vi.fn().mockReturnValue("blob:mock-uuid"),
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

      // Caller provides fallback "default-fallback.xlsx", but server sent "server-attendance-2026.xlsx"
      await downloadReportFile("job-report-1", "default-fallback.xlsx");

      expect(mockAnchor.download).toBe("server-attendance-2026.xlsx");
      expect(clickMock).toHaveBeenCalled();
    });

    it("parses RFC 5987 UTF-8 encoded filename* from Content-Disposition over fallback", async () => {
      const mockBlob = new Blob(["excel-content"]);

      api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        return {
          data: mockBlob,
          status: 200,
          statusText: "OK",
          headers: {
            "content-disposition":
              "attachment; filename=\"fallback.xlsx\"; filename*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1%2D%D8%A7%D9%84%D8%AD%D8%B6%D9%88%D8%B1.xlsx",
          },
          config,
        };
      };

      const clickMock = vi.fn();
      const mockAnchor = { href: "", download: "", click: clickMock };

      vi.stubGlobal("window", {
        URL: {
          createObjectURL: vi.fn().mockReturnValue("blob:mock-uuid"),
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

      await downloadReportFile("job-report-1", "default.xlsx");

      expect(mockAnchor.download).toBe("تقرير-الحضور.xlsx");
    });
  });

  describe("parseContentDispositionFilename unit tests", () => {
    it("returns fallback when header is missing or empty", () => {
      expect(parseContentDispositionFilename(undefined)).toBe("report.xlsx");
      expect(parseContentDispositionFilename(null)).toBe("report.xlsx");
      expect(parseContentDispositionFilename("")).toBe("report.xlsx");
      expect(parseContentDispositionFilename("", "custom.xlsx")).toBe("custom.xlsx");
    });

    it("parses quoted standard filename", () => {
      const header = 'attachment; filename="monthly-report-october.xlsx"';
      expect(parseContentDispositionFilename(header)).toBe("monthly-report-october.xlsx");
    });

    it("parses unquoted filename", () => {
      const header = "attachment; filename=export-data.xlsx";
      expect(parseContentDispositionFilename(header)).toBe("export-data.xlsx");
    });

    it("parses RFC 5987 encoded filename*", () => {
      const header = "attachment; filename*=UTF-8''attendance%20summary.xlsx";
      expect(parseContentDispositionFilename(header)).toBe("attendance summary.xlsx");
    });

    it("prioritizes RFC 5987 filename* over standard filename attribute", () => {
      const header =
        'attachment; filename="ascii-fallback.xlsx"; filename*=UTF-8\'\'arabic-%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.xlsx';
      expect(parseContentDispositionFilename(header)).toBe("arabic-تقرير.xlsx");
    });

    it("sanitizes directory traversal patterns from filename", () => {
      const header = 'attachment; filename="../../etc/shadow.xlsx"';
      expect(parseContentDispositionFilename(header)).toBe("shadow.xlsx");

      const winHeader = 'attachment; filename="C:\\Windows\\System32\\calc.xlsx"';
      expect(parseContentDispositionFilename(winHeader)).toBe("calc.xlsx");
    });
  });
});
