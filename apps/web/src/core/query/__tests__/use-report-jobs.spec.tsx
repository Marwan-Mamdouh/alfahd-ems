import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role } from "@alfahd/types";
import {
  useAttendanceReport,
  useRouterExport,
  useIpImport,
} from "../use-report-jobs";
import * as jobsApi from "@/core/api/jobs";

describe("use-report-jobs hooks RBAC & enqueue behavior", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    useAuthStore.getState().clearSession();
  });

  describe("useAttendanceReport", () => {
    it("enforces ADMIN permission check on attendance report generation", async () => {
      useAuthStore.setState({
        user: {
          id: "tech-1",
          email: "tech@alfahd.local",
          role: Role.TECHNICIAN,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      let hookResult: ReturnType<typeof useAttendanceReport> | undefined;
      function TestComponent() {
        hookResult = useAttendanceReport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(hookResult?.isAdmin).toBe(false);
      await expect(hookResult?.generateReport()).rejects.toThrow(
        "Unauthorized: Only administrators can generate attendance reports"
      );
    });

    it("allows ADMIN user to generate attendance report", async () => {
      useAuthStore.setState({
        user: {
          id: "admin-1",
          email: "admin@alfahd.local",
          role: Role.ADMIN,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      const enqueueSpy = vi
        .spyOn(jobsApi, "enqueueAttendanceReport")
        .mockResolvedValue({ jobId: "job-att-99" });

      let hookResult: ReturnType<typeof useAttendanceReport> | undefined;
      function TestComponent() {
        hookResult = useAttendanceReport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(hookResult?.isAdmin).toBe(true);
      const jobId = await hookResult?.generateReport({ from: "2026-11-01", to: "2026-11-10" });
      expect(jobId).toBe("job-att-99");
      expect(enqueueSpy).toHaveBeenCalledWith({ from: "2026-11-01", to: "2026-11-10" });
    });
  });

  describe("useRouterExport", () => {
    it("enforces ADMIN permission check on router inventory export", async () => {
      useAuthStore.setState({
        user: {
          id: "warehouse-1",
          email: "warehouse@alfahd.local",
          role: Role.WAREHOUSE_STAFF,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      let hookResult: ReturnType<typeof useRouterExport> | undefined;
      function TestComponent() {
        hookResult = useRouterExport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(hookResult?.isAdmin).toBe(false);
      await expect(hookResult?.exportRouters()).rejects.toThrow(
        "Unauthorized: Only administrators can export router inventory"
      );
    });

    it("allows ADMIN user to export router inventory", async () => {
      useAuthStore.setState({
        user: {
          id: "admin-1",
          email: "admin@alfahd.local",
          role: Role.ADMIN,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      const enqueueSpy = vi
        .spyOn(jobsApi, "enqueueRouterExport")
        .mockResolvedValue({ jobId: "job-router-export-1" });

      let hookResult: ReturnType<typeof useRouterExport> | undefined;
      function TestComponent() {
        hookResult = useRouterExport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(hookResult?.isAdmin).toBe(true);
      const jobId = await hookResult?.exportRouters({ warehouseId: "wh-1" });
      expect(jobId).toBe("job-router-export-1");
      expect(enqueueSpy).toHaveBeenCalledWith({ warehouseId: "wh-1" });
    });
  });

  describe("useIpImport", () => {
    it("enforces ADMIN permission check on IP import trigger", async () => {
      useAuthStore.setState({
        user: {
          id: "tech-1",
          email: "tech@alfahd.local",
          role: Role.TECHNICIAN,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      let hookResult: ReturnType<typeof useIpImport> | undefined;
      function TestComponent() {
        hookResult = useIpImport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      const dummyFile = new File(["ip,subnet"], "ips.csv", { type: "text/csv" });

      expect(hookResult?.isAdmin).toBe(false);
      await expect(hookResult?.importFile(dummyFile)).rejects.toThrow(
        "Unauthorized: Only administrators can import IP addresses"
      );
    });

    it("allows ADMIN user to import IP addresses", async () => {
      useAuthStore.setState({
        user: {
          id: "admin-1",
          email: "admin@alfahd.local",
          role: Role.ADMIN,
          isActive: true,
          createdAt: "2026-01-01",
        },
      });

      const dummyFile = new File(["ip,subnet"], "ips.csv", { type: "text/csv" });
      const uploadSpy = vi
        .spyOn(jobsApi, "uploadIpCsvFile")
        .mockResolvedValue({ jobId: "job-ip-import-1" });

      let hookResult: ReturnType<typeof useIpImport> | undefined;
      function TestComponent() {
        hookResult = useIpImport();
        return null;
      }

      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(hookResult?.isAdmin).toBe(true);
      const jobId = await hookResult?.importFile(dummyFile);
      expect(jobId).toBe("job-ip-import-1");
      expect(uploadSpy).toHaveBeenCalledWith(dummyFile);
    });
  });
});
