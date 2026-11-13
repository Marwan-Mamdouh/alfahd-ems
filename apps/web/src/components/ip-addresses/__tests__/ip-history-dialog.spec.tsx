import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpHistoryDialog } from "../ip-history-dialog";
import * as useIpAddressesModule from "@/core/query/use-ip-addresses";
import type { IpHistoryDto } from "@alfahd/types";

vi.mock("@/core/query/use-ip-addresses", async (importOriginal) => {
  const actual = await importOriginal<typeof useIpAddressesModule>();
  return {
    ...actual,
    useIpHistory: vi.fn(),
  };
});

describe("IpHistoryDialog Component (Task B6)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockHistoryItems: IpHistoryDto[] = [
    {
      id: "hist-1",
      ipId: "ip-1",
      action: "CREATE",
      fromStatus: "FREE",
      toStatus: "FREE",
      reason: "Initial registration",
      actorId: "admin-user",
      createdAt: "2026-01-01T10:00:00Z",
    },
    {
      id: "hist-2",
      ipId: "ip-1",
      action: "RESERVE",
      fromStatus: "FREE",
      toStatus: "RESERVED",
      reason: "Reserved for testing",
      actorId: "admin-user",
      createdAt: "2026-01-02T10:00:00Z",
    },
  ];

  it("returns null when isOpen is false", () => {
    vi.mocked(useIpAddressesModule.useIpHistory).mockReturnValue({
      history: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(
      <IpHistoryDialog
        isOpen={false}
        onClose={vi.fn()}
        ipId="ip-1"
        ipAddress="192.168.1.50"
      />
    );
    expect(html).toBe("");
  });

  it("renders audit ledger with action badges and transition details", () => {
    vi.mocked(useIpAddressesModule.useIpHistory).mockReturnValue({
      history: mockHistoryItems,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(
      <IpHistoryDialog
        isOpen={true}
        onClose={vi.fn()}
        ipId="ip-1"
        ipAddress="192.168.1.50"
      />
    );

    expect(html).toContain("ip-history-dialog");
    expect(html).toContain("192.168.1.50");
    expect(html).toContain("إنشاء (CREATE)");
    expect(html).toContain("حجز (RESERVE)");
    expect(html).toContain("admin-user");
  });

  it("renders loading state", () => {
    vi.mocked(useIpAddressesModule.useIpHistory).mockReturnValue({
      history: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(
      <IpHistoryDialog
        isOpen={true}
        onClose={vi.fn()}
        ipId="ip-1"
        ipAddress="192.168.1.50"
      />
    );

    expect(html).toContain("ip-history-loading");
    expect(html).toContain("جاري تحميل سجل العمليات...");
  });
});
