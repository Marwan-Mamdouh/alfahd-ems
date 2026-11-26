import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role, IpStatus, type UserDto } from "@alfahd/types";
import * as useIpAddressesModule from "@/core/query/use-ip-addresses";
import * as useReportJobsModule from "@/core/query/use-report-jobs";
import IpPreviewPage from "../page";

const authState: { user: UserDto | null } = { user: null };

vi.mock("@/core/auth/auth.store", () => ({
  useAuthStore: <T,>(selector: (state: { user: UserDto | null }) => T) => selector(authState),
}));

vi.mock("@/core/query/use-ip-addresses", async (importOriginal) => {
  const actual = await importOriginal<typeof useIpAddressesModule>();
  return {
    ...actual,
    useIpAddresses: vi.fn(),
  };
});

vi.mock("@/core/query/use-report-jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof useReportJobsModule>();
  return {
    ...actual,
    useIpImport: vi.fn(),
  };
});

describe("IpPreviewPage Role Views (Issue #87)", () => {
  let queryClient: QueryClient;

  const mockIps = [
    {
      id: "ip-1",
      address: "192.168.1.10",
      status: IpStatus.FREE,
      isArchived: false,
      customerId: null,
      notes: "Core gateway",
      createdAt: "2026-01-01T10:00:00Z",
      updatedAt: "2026-01-01T10:00:00Z",
    },
    {
      id: "ip-2",
      address: "192.168.1.20",
      status: IpStatus.RESERVED,
      isArchived: false,
      customerId: "cust-1",
      notes: "Assigned VIP",
      createdAt: "2026-01-02T10:00:00Z",
      updatedAt: "2026-01-02T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    authState.user = null;

    vi.mocked(useIpAddressesModule.useIpAddresses).mockReturnValue({
      data: { items: mockIps, total: 2, page: 1, pageSize: 15, totalPages: 1 },
      ipAddresses: mockIps,
      total: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useReportJobsModule.useIpImport).mockReturnValue({
      jobId: null,
      job: null,
      status: null,
      isAdmin: true,
      isImporting: false,
      isCompleted: false,
      isFailed: false,
      isTimedOut: false,
      error: null,
      summary: { inserted: 0, skipped: 0, errors: [] },
      importFile: vi.fn(),
      retryPolling: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("renders full admin management controls (create, CSV import, row actions, history) for ADMIN", () => {
    authState.user = {
      id: "admin-1",
      email: "admin@alfahd.local",
      role: Role.ADMIN,
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <IpPreviewPage />
      </QueryClientProvider>
    );

    expect(html).toContain("ip-preview-page");
    expect(html).not.toContain("ip-technician-notice");
    expect(html).toContain("ip-import-open-btn");
    expect(html).toContain("ip-create-open-btn");
    expect(html).toContain("reserve-btn-ip-1");
    expect(html).toContain("release-btn-ip-2");
    expect(html).toContain("history-btn-ip-1");
  });

  it("renders read-only view for TECHNICIAN without admin actions, history, create, or CSV import", () => {
    authState.user = {
      id: "tech-1",
      email: "tech@alfahd.local",
      role: Role.TECHNICIAN,
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <IpPreviewPage />
      </QueryClientProvider>
    );

    expect(html).toContain("ip-preview-page");
    expect(html).toContain("ip-technician-notice");
    expect(html).toContain("192.168.1.10");
    expect(html).toContain("192.168.1.20");
    expect(html).not.toContain("ip-import-open-btn");
    expect(html).not.toContain("ip-create-open-btn");
    expect(html).not.toContain("reserve-btn-ip-1");
    expect(html).not.toContain("release-btn-ip-2");
    expect(html).not.toContain("history-btn-ip-1");
  });

  it("denies access for unauthorized roles such as WAREHOUSE_STAFF", () => {
    authState.user = {
      id: "wh-1",
      email: "wh@alfahd.local",
      role: Role.WAREHOUSE_STAFF,
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <IpPreviewPage />
      </QueryClientProvider>
    );

    expect(html).toContain("غير مصرح بالوصول");
    expect(html).not.toContain("ip-preview-page");
  });
});
