import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterTransitionDialog } from "../router-transition-dialog";
import type { RouterRow } from "../types";

describe("RouterTransitionDialog Component", () => {
  const mockRouter: RouterRow = {
    id: "router-1",
    serialNumber: "TPL-2026-00001",
    productId: "prod-1",
    productName: "TP-Link Archer C6",
    status: "RETURNED",
    physicalCondition: "SERVICEABLE",
    warehouseId: "wh-1",
    warehouseName: "Main Depot",
    externalLocation: null,
    currentHolderType: "WAREHOUSE",
    currentHolderId: "wh-1",
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
  };

  const mockWarehouses = [
    { id: "wh-1", name: "Main Depot" },
    { id: "wh-2", name: "Alex Depot" },
  ];

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <RouterTransitionDialog
        router={mockRouter}
        warehouses={mockWarehouses}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders allowed transition choices for RETURNED status", () => {
    const html = renderToStaticMarkup(
      <RouterTransitionDialog
        router={mockRouter}
        warehouses={mockWarehouses}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تغيير حالة دورة الراوتر");
    expect(html).toContain("TPL-2026-00001");
    // Allowed from RETURNED: AVAILABLE, UNDER_REPAIR, DAMAGED
    expect(html).toContain("AVAILABLE");
    expect(html).toContain("UNDER_REPAIR");
    expect(html).toContain("DAMAGED");
    expect(html).toContain("سبب الانتقال التشغيلي");
  });

  it("renders terminal state notice when router is in terminal status (LOST / DECOMMISSIONED)", () => {
    const lostRouter: RouterRow = {
      ...mockRouter,
      status: "LOST",
    };

    const html = renderToStaticMarkup(
      <RouterTransitionDialog
        router={lostRouter}
        warehouses={mockWarehouses}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("حالة نهائية غير قابلة للتغيير");
    expect(html).toContain("لا يمكن تغيير حالته التشغيلية");
    expect(html).not.toContain("الحالة الجديدة المستهدفة");
  });

  it("gates customer installation when router is ASSIGNED_TO_TECHNICIAN", () => {
    const assignedRouter: RouterRow = {
      ...mockRouter,
      status: "ASSIGNED_TO_TECHNICIAN",
      warehouseId: null,
      warehouseName: null,
      currentHolderType: "TECHNICIAN",
      currentHolderId: "tech-1",
    };

    const html = renderToStaticMarkup(
      <RouterTransitionDialog
        router={assignedRouter}
        warehouses={mockWarehouses}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    // INSTALLED_AT_CUSTOMER should be disabled with M3a notice
    expect(html).toContain("مؤجل لمرحلة M3a - التذاكر");
    expect(html).toContain("disabled");
  });
});

