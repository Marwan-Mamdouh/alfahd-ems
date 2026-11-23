import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterDetail } from "../router-detail";
import type { RouterRow } from "../types";

// Mock router triple audit to isolate detail component testing
vi.mock("../router-triple-audit", () => ({
  RouterTripleAudit: () => <div data-testid="mock-triple-audit">Mock Triple Audit</div>,
}));

describe("RouterDetail Component", () => {
  const baseRouter: RouterRow = {
    id: "router-1",
    serialNumber: "SN-EGY-2026-9999",
    productId: "p-1",
    productName: "Huawei EchoLife EG8145V5",
    productSku: "HUA-EG8145V5",
    productModel: "EG8145V5",
    status: "AVAILABLE",
    physicalCondition: "SERVICEABLE",
    warehouseId: "wh-1",
    warehouseName: "المخزن الرئيسي",
    externalLocation: null,
    currentHolderType: "WAREHOUSE",
    currentHolderId: "wh-1",
    currentHolderName: "المخزن الرئيسي",
    notes: "فحص أولي مكتمل",
    createdAt: "2026-02-01T12:00:00Z",
  };

  it("renders router serial number, product details, and four independent dimensions", () => {
    const html = renderToStaticMarkup(
      <RouterDetail
        router={baseRouter}
        canManage={true}
        onBack={vi.fn()}
        onAssign={vi.fn()}
        onTransition={vi.fn()}
        onUpdateCondition={vi.fn()}
      />
    );

    expect(html).toContain("SN-EGY-2026-9999");
    expect(html).toContain("Huawei EchoLife EG8145V5");
    expect(html).toContain("HUA-EG8145V5");

    // Four dimensions
    expect(html).toContain("1. دورة الحياة (Lifecycle)");
    expect(html).toContain("متاح بالمخزن");
    expect(html).toContain("2. الحالة الفيزيائية (Condition)");
    expect(html).toContain("سليم");
    expect(html).toContain("3. الموقع الفيزيائي (Location)");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("4. العهدة الحالية (Custody)");
    expect(html).toContain("عهدة المخزن (المخزن الرئيسي)");

    // Actions
    expect(html).toContain("صرف وتخصيص للفني");
    expect(html).toContain("تغيير حالة الدورة");
    expect(html).toContain("تعديل الحالة والموقع");

    // Embedded Triple Audit
    expect(html).toContain("Mock Triple Audit");
  });

  it("displays assignment ineligibility alert and hides assign button when router is AVAILABLE but DAMAGED", () => {
    const damagedAvailableRouter: RouterRow = {
      ...baseRouter,
      status: "AVAILABLE",
      physicalCondition: "DAMAGED",
    };

    const html = renderToStaticMarkup(
      <RouterDetail
        router={damagedAvailableRouter}
        canManage={true}
        onAssign={vi.fn()}
        onTransition={vi.fn()}
        onUpdateCondition={vi.fn()}
      />
    );

    expect(html).toContain("الجهاز غير مؤهل للصرف الميداني");
    expect(html).toContain("تمنع صرفه للفني. يجب صيانة الجهاز والتأكد من سلامته أولاً.");
    expect(html).not.toContain("صرف وتخصيص للفني");
  });

  it("displays assignment ineligibility alert when router is AVAILABLE but has no warehouseId", () => {
    const noWarehouseRouter: RouterRow = {
      ...baseRouter,
      status: "AVAILABLE",
      warehouseId: null,
      warehouseName: null,
      externalLocation: "مقر الإصلاح",
    };

    const html = renderToStaticMarkup(
      <RouterDetail
        router={noWarehouseRouter}
        canManage={true}
        onAssign={vi.fn()}
        onTransition={vi.fn()}
        onUpdateCondition={vi.fn()}
      />
    );

    expect(html).toContain("الجهاز غير مؤهل للصرف الميداني");
    expect(html).toContain("الجهاز غير مرتبط بمخزن معتمد حالياً");
    expect(html).not.toContain("صرف وتخصيص للفني");
  });

  it("displays terminal state banner and hides lifecycle and condition actions for LOST router", () => {
    const lostRouter: RouterRow = {
      ...baseRouter,
      status: "LOST",
      currentHolderType: null,
      currentHolderId: null,
    };

    const html = renderToStaticMarkup(
      <RouterDetail
        router={lostRouter}
        canManage={true}
        onAssign={vi.fn()}
        onTransition={vi.fn()}
        onUpdateCondition={vi.fn()}
      />
    );

    expect(html).toContain("حالة نهائية غير قابلة للتغيير");
    expect(html).toContain("لا يمكن نقل عهدته أو تغيير حالته أو تعديل موقعه.");
    expect(html).not.toContain("صرف وتخصيص للفني");
    expect(html).not.toContain("تغيير حالة الدورة");
    expect(html).not.toContain("تعديل الحالة والموقع");
  });

  it("displays terminal state banner and hides actions for DECOMMISSIONED router", () => {
    const decommRouter: RouterRow = {
      ...baseRouter,
      status: "DECOMMISSIONED",
    };

    const html = renderToStaticMarkup(
      <RouterDetail
        router={decommRouter}
        canManage={true}
        onAssign={vi.fn()}
        onTransition={vi.fn()}
        onUpdateCondition={vi.fn()}
      />
    );

    expect(html).toContain("حالة نهائية غير قابلة للتغيير");
    expect(html).not.toContain("تغيير حالة الدورة");
  });

  it("renders custody correctly when assigned to technician", () => {
    const techRouter: RouterRow = {
      ...baseRouter,
      status: "ASSIGNED_TO_TECHNICIAN",
      warehouseId: null,
      warehouseName: null,
      currentHolderType: "TECHNICIAN",
      currentHolderId: "tech-123",
      currentHolderName: "أحمد عبد الله",
    };

    const html = renderToStaticMarkup(
      <RouterDetail router={techRouter} canManage={false} />
    );

    expect(html).toContain("أحمد عبد الله");
  });

  it("renders empty custody label when router has no current holder", () => {
    const noCustodyRouter: RouterRow = {
      ...baseRouter,
      currentHolderType: null,
      currentHolderId: null,
      currentHolderName: null,
    };

    const html = renderToStaticMarkup(
      <RouterDetail router={noCustodyRouter} canManage={false} />
    );

    expect(html).toContain("بدون عهدة");
  });
});
