import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterConditionDialog } from "../router-condition-dialog";
import type { RouterRow } from "../types";

describe("RouterConditionDialog Component", () => {
  const mockRouter: RouterRow = {
    id: "router-1",
    serialNumber: "TPL-2026-00001",
    productId: "prod-1",
    productName: "TP-Link Archer C6",
    status: "AVAILABLE",
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
      <RouterConditionDialog
        router={mockRouter}
        warehouses={mockWarehouses}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders condition dialog with condition and location options", () => {
    const html = renderToStaticMarkup(
      <RouterConditionDialog
        router={mockRouter}
        warehouses={mockWarehouses}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تحديث الحالة الفيزيائية والموقع");
    expect(html).toContain("TPL-2026-00001");
    expect(html).toContain("SERVICEABLE");
    expect(html).toContain("DAMAGED");
    expect(html).toContain("UNDER_REPAIR");
    expect(html).toContain("مخزن داخلي");
    expect(html).toContain("موقع صيانة خارجي");
    expect(html).toContain("سبب التعديل أو تقرير الفحص");
  });

  it("renders terminal block when router is in terminal status (DECOMMISSIONED)", () => {
    const decommRouter: RouterRow = {
      ...mockRouter,
      status: "DECOMMISSIONED",
    };

    const html = renderToStaticMarkup(
      <RouterConditionDialog
        router={decommRouter}
        warehouses={mockWarehouses}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("حالة نهائية غير قابلة للتعديل");
    expect(html).toContain("مكهن خارج الخدمة");
    expect(html).not.toContain("الحالة الفيزيائية الجديدة");
  });
});

