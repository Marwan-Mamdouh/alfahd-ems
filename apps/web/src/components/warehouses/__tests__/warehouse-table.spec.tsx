import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseTable } from "../warehouse-table";
import type { WarehouseRow } from "../types";

describe("WarehouseTable Component", () => {
  const mockWarehouses: WarehouseRow[] = [
    {
      id: "wh-1",
      name: "مخزن الجيزة الرئيسي",
      address: "شارع الهرم، الجيزة",
      latitude: 29.987,
      longitude: 31.189,
      geofenceRadiusMeters: 150,
      managerId: "mgr-1",
      managerName: "يوسف الشريف",
      isActive: true,
    },
    {
      id: "wh-2",
      name: "مخزن طنطا الفرعي",
      address: "شارع الجيش، طنطا",
      latitude: 30.7865,
      longitude: 31.0004,
      geofenceRadiusMeters: 200,
      managerId: null,
      managerName: null,
      isActive: false,
    },
  ];

  it("renders warehouse rows with badges, coordinates, and geofence", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={mockWarehouses}
      />
    );

    expect(html).toContain("مخزن الجيزة الرئيسي");
    expect(html).toContain("شارع الهرم، الجيزة");
    expect(html).toContain("نشط");
    expect(html).toContain("150 متر");
    expect(html).toContain("29.9870");
    expect(html).toContain("31.1890");

    expect(html).toContain("مخزن طنطا الفرعي");
    expect(html).toContain("شارع الجيش، طنطا");
    expect(html).toContain("معطل");
    expect(html).toContain("200 متر");
  });

  it("renders manager name when known and fallback when unassigned", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={mockWarehouses}
      />
    );

    expect(html).toContain("يوسف الشريف");
    expect(html).toContain("بدون مدير معين");
  });

  it("renders View action for all users, but Edit/Deactivate only when canManage is true", () => {
    const htmlReadOnly = renderToStaticMarkup(
      <WarehouseTable
        warehouses={mockWarehouses}
        canManage={false}
        onWarehouseClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeactivateClick={vi.fn()}
      />
    );

    expect(htmlReadOnly).toContain("عرض");
    expect(htmlReadOnly).not.toContain("تعديل");
    expect(htmlReadOnly).not.toContain("تعطيل");

    const htmlAdmin = renderToStaticMarkup(
      <WarehouseTable
        warehouses={mockWarehouses}
        canManage={true}
        onWarehouseClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeactivateClick={vi.fn()}
      />
    );

    expect(htmlAdmin).toContain("عرض");
    expect(htmlAdmin).toContain("تعديل");
    expect(htmlAdmin).toContain("تعطيل");
    // Ensure "تعطيل" is only present for the active warehouse (wh-1), not the inactive one (wh-2)
    expect(htmlAdmin).toContain("aria-label=\"تعطيل مخزن الجيزة الرئيسي\"");
    expect(htmlAdmin).not.toContain("aria-label=\"تعطيل مخزن طنطا الفرعي\"");
    // Hard delete button must never exist
    expect(htmlAdmin).not.toContain("حذف");
  });

  it("renders empty state when warehouses list is empty", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={[]}
      />
    );

    expect(html).toContain("لا توجد مخازن");
    expect(html).toContain("لم تتم إضافة أي مخازن إلى النظام بعد");
  });

  it("renders loading state when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={[]}
        isLoading={true}
      />
    );

    expect(html).toContain("animate-spin");
  });

  it("renders error message and retry button when error is present", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={[]}
        error={new Error("تعذر الاتصال بقاعدة بيانات المخازن")}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("تعذر الاتصال بقاعدة بيانات المخازن");
  });

  it("renders pagination controls when page and total are provided", () => {
    const html = renderToStaticMarkup(
      <WarehouseTable
        warehouses={mockWarehouses}
        page={1}
        pageSize={10}
        total={25}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("صفحة 1 من 3 (إجمالي 25 مخزن)");
    expect(html).toContain("السابق");
    expect(html).toContain("التالي");
  });
});
