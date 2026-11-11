import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterTripleAudit } from "../router-triple-audit";
import * as routerHooks from "@/core/query/use-routers";

vi.mock("@/core/query/use-routers", async (importOriginal) => {
  const actual = await importOriginal<typeof routerHooks>();
  return {
    ...actual,
    useRouterAssignments: vi.fn(),
    useRouterConditionHistory: vi.fn(),
    useRouterStatusHistory: vi.fn(),
  };
});

describe("RouterTripleAudit Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 3 audit tabs with counts and active custody data", () => {
    vi.mocked(routerHooks.useRouterAssignments).mockReturnValue({
      assignments: [
        {
          id: "asgn-1",
          routerId: "router-1",
          holderType: "WAREHOUSE",
          warehouseId: "wh-1",
          technicianId: null,
          assignedAt: "2026-01-01T10:00:00Z",
          releasedAt: null,
          assignedBy: "user-1",
          notes: "Initial storage",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(routerHooks.useRouterConditionHistory).mockReturnValue({
      conditionHistory: [
        {
          id: "ch-1",
          routerId: "router-1",
          fromCondition: "SERVICEABLE",
          toCondition: "DAMAGED",
          fromWarehouseId: "wh-1",
          toWarehouseId: null,
          externalLocation: null,
          reason: "Dropped port",
          changedBy: "user-1",
          createdAt: "2026-01-02T10:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(routerHooks.useRouterStatusHistory).mockReturnValue({
      statusHistory: [
        {
          id: "sh-1",
          routerId: "router-1",
          fromStatus: "AVAILABLE",
          toStatus: "ASSIGNED_TO_TECHNICIAN",
          reason: "Dispatching to tech",
          changedBy: "user-1",
          createdAt: "2026-01-03T10:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<RouterTripleAudit routerId="router-1" />);

    expect(html).toContain("سجل العهدة والتخصيصات");
    expect(html).toContain("سجل الحالة الفيزيائية والموقع");
    expect(html).toContain("سجل دورة الحياة");
    // Tab badge counts
    expect(html).toContain("1");
    // Assignments content
    expect(html).toContain("عهدة مخزن");
    expect(html).toContain("عهدة نشطة حالياً");
    expect(html).toContain("Initial storage");
  });

  it("renders empty state when no assignments exist", () => {
    vi.mocked(routerHooks.useRouterAssignments).mockReturnValue({
      assignments: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(routerHooks.useRouterConditionHistory).mockReturnValue({
      conditionHistory: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(routerHooks.useRouterStatusHistory).mockReturnValue({
      statusHistory: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<RouterTripleAudit routerId="router-1" />);

    expect(html).toContain("لا توجد سجلات عهدة سابقة لهذا الجهاز");
  });
});

