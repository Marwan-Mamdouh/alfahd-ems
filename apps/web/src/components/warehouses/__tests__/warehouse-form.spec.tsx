import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseForm } from "../warehouse-form";
import type { ManagerOption, WarehouseRow } from "../types";

describe("WarehouseForm Component", () => {
  const mockWarehouse: WarehouseRow = {
    id: "wh-12345",
    name: "مخزن القاهرة المركزي",
    address: "شارع الطيران، مدينة نصر، القاهرة",
    latitude: 30.0561,
    longitude: 31.3301,
    geofenceRadiusMeters: 250,
    managerId: "mgr-admin-1",
    managerName: "أحمد عبد الله",
    isActive: true,
  };

  const mockManagers: ManagerOption[] = [
    {
      id: "mgr-admin-1",
      name: "أحمد عبد الله",
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      id: "mgr-staff-2",
      name: "محمود فوزي",
      role: "WAREHOUSE_STAFF",
      status: "ACTIVE",
    },
  ];

  it("renders create form in Arabic RTL layout by default", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        onSubmit={vi.fn()}
        managers={mockManagers}
      />
    );

    expect(html).toContain("إضافة مخزن جديد");
    expect(html).toContain("اسم المخزن *");
    expect(html).toContain("عنوان المخزن *");
    expect(html).toContain("خط العرض (Latitude) *");
    expect(html).toContain("خط الطول (Longitude) *");
    expect(html).toContain("نطاق السياج الجغرافي (بالأمتار) *");
    expect(html).toContain("مدير المخزن المسؤول");
    expect(html).toContain("150"); // default radius
    expect(html).toContain('dir="rtl"');
  });

  it("renders edit form pre-populated with warehouse values", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        warehouse={mockWarehouse}
        onSubmit={vi.fn()}
        managers={mockManagers}
      />
    );

    expect(html).toContain("تعديل بيانات المخزن");
    expect(html).toContain("مخزن القاهرة المركزي");
    expect(html).toContain("شارع الطيران، مدينة نصر، القاهرة");
    expect(html).toContain("30.0561");
    expect(html).toContain("31.3301");
    expect(html).toContain("250");
    expect(html).toContain("حفظ التعديلات");
  });

  it("disables inputs and buttons during submission to prevent duplicate submits", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("جاري الحفظ...");
    expect(html).toContain("disabled");
  });

  it("displays server error alert and preserves inputs", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        warehouse={mockWarehouse}
        onSubmit={vi.fn()}
        serverError="اسم المخزن مكرر بالفعل في نفس النطاق الجغرافي"
      />
    );

    expect(html).toContain("اسم المخزن مكرر بالفعل في نفس النطاق الجغرافي");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("مخزن القاهرة المركزي");
  });

  it("renders specific field errors when provided", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        onSubmit={vi.fn()}
        fieldErrors={{
          latitude: "خط العرض يجب أن يكون بين -90 و90",
          geofenceRadiusMeters: "نطاق السياج الجغرافي يجب أن يكون بين 50 و 2000 متر",
        }}
      />
    );

    expect(html).toContain("خط العرض يجب أن يكون بين -90 و90");
    expect(html).toContain("نطاق السياج الجغرافي يجب أن يكون بين 50 و 2000 متر");
  });

  it("displays explanatory banner for GPS and geofence", () => {
    const html = renderToStaticMarkup(
      <WarehouseForm
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("السياج والموقع الجغرافي");
    expect(html).toContain("بحد أدنى 50 مترًا وأقصى 2000 متر");
  });
});
