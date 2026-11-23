import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseManagement } from "../warehouse-management";
import type { WarehouseRow } from "../types";

describe("WarehouseManagement Coordinator Component", () => {
  const mockWarehouses: WarehouseRow[] = [
    {
      id: "wh-1",
      name: "مخزن الإسماعيلية",
      address: "شارع السكة الحديد، الإسماعيلية",
      latitude: 30.5965,
      longitude: 32.2715,
      geofenceRadiusMeters: 150,
      managerId: "mgr-1",
      managerName: "خالد سعيد",
      isActive: true,
    },
    {
      id: "wh-2",
      name: "مخزن السويس الميداني",
      address: "شارع الجيش، السويس",
      latitude: 29.9668,
      longitude: 32.5498,
      geofenceRadiusMeters: 180,
      managerId: null,
      managerName: null,
      isActive: false,
    },
  ];

  it("renders list view with banner, statistics, search filters, and table", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagement
        warehouses={mockWarehouses}
        canManage={true}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDeactivate={vi.fn()}
      />
    );

    expect(html).toContain("إدارة المستودعات ونقاط الإمداد");
    expect(html).toContain("إجمالي المخازن المسجلة");
    expect(html).toContain("المخازن النشطة");
    expect(html).toContain("المخازن المعطلة");
    expect(html).toContain("البحث في المخازن");
    expect(html).toContain("كافة الحالات");
    expect(html).toContain("إضافة مخزن جديد");
    expect(html).toContain("مخزن الإسماعيلية");
    expect(html).toContain("مخزن السويس الميداني");
  });

  it("hides Add Warehouse button when canCreate/canManage is false", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagement
        warehouses={mockWarehouses}
        canManage={false}
        capabilities={{
          create: false,
          edit: false,
          deactivate: false,
        }}
      />
    );

    expect(html).not.toContain("إضافة مخزن جديد");
  });

  it("renders loading state cleanly when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagement
        warehouses={[]}
        isLoading={true}
      />
    );

    expect(html).toContain("animate-spin");
  });
});
