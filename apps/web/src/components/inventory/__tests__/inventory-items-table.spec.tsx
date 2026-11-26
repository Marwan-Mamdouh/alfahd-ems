import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryItemsTable } from "../inventory-items-table";
import type { InventoryItemRow } from "../types";

describe("InventoryItemsTable Component", () => {
  const mockActiveProduct: InventoryItemRow = {
    id: "prod-1",
    name: "Fiber Router AX1800",
    sku: "RTR-AX1800",
    model: "AX1800-V2",
    category: "راوترات",
    description: "Gigabit Wi-Fi 6 Router",
    lowStockThreshold: 10,
    totalStock: 50,
    isSerialized: true,
    isActive: true,
  };

  const mockInactiveProduct: InventoryItemRow = {
    id: "prod-2",
    name: "Drop Cable 50m",
    sku: "CAB-50M",
    model: "LC-50",
    category: "كابلات",
    description: "Fiber patch cord",
    lowStockThreshold: 5,
    totalStock: 0,
    isSerialized: false,
    isActive: false,
  };

  it("renders product rows with SKU, model, category, and status badges", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[mockActiveProduct, mockInactiveProduct]}
      />
    );

    expect(html).toContain("Fiber Router AX1800");
    expect(html).toContain("RTR-AX1800");
    expect(html).toContain("AX1800-V2");
    expect(html).toContain("نشط");
    expect(html).toContain("سيريال");
    expect(html).toContain(`الإجمالي: ${(50).toLocaleString("ar-EG")}`);

    expect(html).toContain("Drop Cable 50m");
    expect(html).toContain("CAB-50M");
    expect(html).toContain("معطّل / مؤرشف");
  });

  it("renders View, Edit, and Deactivate buttons according to permissions", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[mockActiveProduct, mockInactiveProduct]}
        canEdit={true}
        canDeactivate={true}
        onItemClick={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />
    );

    expect(html).toContain("عرض");
    expect(html).toContain("تعديل");
    expect(html).toContain("تعطيل");
    // Ensure "تعطيل" is only present for the active item, not the already inactive item
    expect(html).toContain("aria-label=\"تعطيل صنف Fiber Router AX1800\"");
    expect(html).not.toContain("aria-label=\"تعطيل صنف Drop Cable 50m\"");
    // Hard delete must never exist
    expect(html).not.toContain("حذف");
  });

  it("hides Edit and Deactivate buttons when permissions are false", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[mockActiveProduct]}
        canEdit={false}
        canDeactivate={false}
        onItemClick={vi.fn()}
      />
    );

    expect(html).toContain("عرض");
    expect(html).not.toContain("تعديل");
    expect(html).not.toContain("تعطيل");
  });

  it("renders empty state when items list is empty", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[]}
      />
    );

    expect(html).toContain("لا توجد أصناف في الكتالوج");
    expect(html).toContain("لم يتم تسجيل أي أصناف في النظام بعد");
  });

  it("renders loading state when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[]}
        isLoading={true}
      />
    );

    expect(html).toContain("animate-spin");
  });

  it("renders error state with retry when error is provided", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[]}
        error="فشل استرجاع كتالوج الأصناف"
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("فشل استرجاع كتالوج الأصناف");
  });

  it("renders pagination controls when total > pageSize", () => {
    const html = renderToStaticMarkup(
      <InventoryItemsTable
        items={[mockActiveProduct]}
        page={1}
        pageSize={10}
        total={30}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("صفحة 1 من 3 (إجمالي 30 صنف)");
    expect(html).toContain("السابق");
    expect(html).toContain("التالي");
  });
});
