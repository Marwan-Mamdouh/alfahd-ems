import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterAssignmentForm } from "../router-assignment-form";
import type { RouterRow } from "../types";

describe("RouterAssignmentForm Component", () => {
  const eligibleRouter: RouterRow = {
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

  const damagedRouter: RouterRow = {
    ...eligibleRouter,
    id: "router-damaged",
    serialNumber: "TPL-DAMAGED-999",
    physicalCondition: "DAMAGED",
  };

  const nonWarehouseRouter: RouterRow = {
    ...eligibleRouter,
    id: "router-no-wh",
    serialNumber: "TPL-NOWH-888",
    warehouseId: null,
    warehouseName: null,
    externalLocation: "مركز صيانة",
  };

  const mockTechnicians = [
    { id: "tech-1", name: "محمود أحمد" },
    { id: "tech-2", name: "علي حسن" },
  ];

  it("renders disabled technician selection and warning note when no technicians are available", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[eligibleRouter]}
        technicians={[]}
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("لا يوجد فنيين نشطين مسجلين");
    expect(html).toContain("لا يمكن صرف الراوتر لعدم وجود فنيين نشطين مسجلين في النظام حالياً.");
    expect(html).toContain("disabled");
  });

  it("renders technician options when technicians list is populated", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[eligibleRouter]}
        technicians={mockTechnicians}
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("محمود أحمد");
    expect(html).toContain("علي حسن");
    expect(html).not.toContain("لا يوجد فنيين نشطين مسجلين");
  });

  it("filters out ineligible routers (DAMAGED or non-warehouse) from assignable selection", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[eligibleRouter, damagedRouter, nonWarehouseRouter]}
        technicians={mockTechnicians}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    // Eligible router serial should be rendered in dropdown options
    expect(html).toContain("TPL-2026-00001");
    // Ineligible router serials should NOT be in the assignable options
    expect(html).not.toContain("TPL-DAMAGED-999");
    expect(html).not.toContain("TPL-NOWH-888");
  });

  it("shows warning when no assignable routers are available in stock", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[damagedRouter, nonWarehouseRouter]}
        technicians={mockTechnicians}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("لا توجد أجهزة راوتر صالحة ومتاحة بالمخزن حاليًا");
  });

  it("disables submit and shows loading spinner when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[eligibleRouter]}
        technicians={mockTechnicians}
        isSubmitting={true}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("جاري التخصيص...");
    expect(html).toContain("disabled");
  });
});
