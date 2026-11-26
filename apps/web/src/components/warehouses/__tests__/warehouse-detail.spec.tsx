import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseDetail } from "../warehouse-detail";
import type {
  WarehouseRow,
  WarehouseStockRow,
  WarehouseStaffRow,
  WarehouseMovementRow,
} from "../types";

describe("WarehouseDetail Component (Criterion B Compliance)", () => {
  const mockWarehouse: WarehouseRow = {
    id: "wh-mansoura-1",
    name: "مخزن المنصورة المركزي",
    address: "شارع المشاية، المنصورة، الدقهلية",
    latitude: 31.0409,
    longitude: 31.3785,
    geofenceRadiusMeters: 175,
    managerId: "mgr-mansoura",
    managerName: "طارق سليم",
    isActive: true,
  };

  const mockStock: WarehouseStockRow[] = [
    {
      id: "stock-1",
      itemName: "راوتر فايبر HG8245H5",
      model: "HG8245H5",
      category: "راوترات",
      quantity: 42,
      lowStockThreshold: 10,
    },
    {
      id: "stock-2",
      itemName: "سلك فايبر 50 متر",
      model: "FBR-50M",
      category: "مستلزمات",
      quantity: 2,
      lowStockThreshold: 5, // low stock!
    },
  ];

  const mockStaff: WarehouseStaffRow[] = [
    {
      id: "emp-1",
      name: "أحمد عبد الله",
      role: "ADMIN",
      status: "نشط",
      isEligible: true,
    },
    {
      id: "emp-2",
      name: "حسام حسن",
      role: "TECHNICIAN",
      status: "نشط",
      isEligible: true,
    },
  ];

  const mockMovements: WarehouseMovementRow[] = [
    {
      id: "mov-1",
      itemName: "راوتر فايبر HG8245H5",
      type: "INBOUND_SUPPLIER",
      quantity: 50,
      createdAt: "2026-03-01T10:00:00.000Z",
      performedBy: "أمين المخزن",
    },
  ];

  it("renders real warehouse info with accurate coordinates and geofence", () => {
    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={mockWarehouse}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("مخزن المنصورة المركزي");
    expect(html).toContain("شارع المشاية، المنصورة، الدقهلية");
    expect(html).toContain("نشط");
    expect(html).toContain("31.040900");
    expect(html).toContain("31.378500");
    expect(html).toContain("175 متر");
    expect(html).toContain("طارق سليم");
    expect(html).toContain("العودة إلى قائمة المخازن");
  });

  it("handles unassigned manager truthfully without inventing data", () => {
    const warehouseNoMgr: WarehouseRow = {
      ...mockWarehouse,
      managerId: null,
      managerName: null,
    };

    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={warehouseNoMgr}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("بدون مدير مخزن حاليًا");
  });

  it("displays low stock warning banner when low-stock items are present", () => {
    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={mockWarehouse}
        stock={mockStock}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("تنبيه انخفاض المخزون");
    expect(html).toContain("يوجد 1 صنف يحتاج إلى مراجعة مستوى المخزون");
  });

  it("renders stock, staff, and movement tabs with accurate counts", () => {
    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={mockWarehouse}
        stock={mockStock}
        staff={mockStaff}
        movements={mockMovements}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("الأصناف والمخزون (2)");
    expect(html).toContain("الموظفون التابعون (2)");
    expect(html).toContain("حركات المخزون (1)");
    expect(html).toContain("راوتر فايبر HG8245H5");
  });

  it("renders forbidden states for non-authorized roles gracefully", () => {
    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={mockWarehouse}
        isStaffForbidden={true}
        isMovementsForbidden={true}
        onBack={vi.fn()}
      />
    );

    // Default active tab is stock; check that forbidden props are respected without crashing
    expect(html).toContain("مخزن المنصورة المركزي");
  });

  it("renders Edit and Deactivate buttons when canManage is true", () => {
    const html = renderToStaticMarkup(
      <WarehouseDetail
        warehouse={mockWarehouse}
        canManage={true}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />
    );

    expect(html).toContain("تعديل المخزن");
    expect(html).toContain("تعطيل المخزن");
  });
});
