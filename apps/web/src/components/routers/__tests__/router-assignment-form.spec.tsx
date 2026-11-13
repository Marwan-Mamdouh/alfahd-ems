import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterAssignmentForm } from "../router-assignment-form";
import type { RouterRow } from "../types";

describe("RouterAssignmentForm Component", () => {
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

  it("renders disabled technician selection and warning note when no technicians are available", () => {
    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[mockRouter]}
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
    const mockTechnicians = [
      { id: "tech-1", name: "محمود أحمد" },
      { id: "tech-2", name: "علي حسن" },
    ];

    const html = renderToStaticMarkup(
      <RouterAssignmentForm
        routers={[mockRouter]}
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
});
