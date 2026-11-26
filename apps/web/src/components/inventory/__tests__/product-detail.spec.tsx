import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDetail } from "../product-detail";
import type { ProductRow, InventoryStockRow, InventoryMovementRow } from "../types";

describe("ProductDetail Component (Detailed View & Serialized Guardrails)", () => {
  const mockSerializedProduct: ProductRow = {
    id: "prod-1",
    name: "Huawei HG8245H5 Optical Terminal",
    sku: "HUA-HG8245H5",
    model: "HG8245H5",
    category: "أجهزة راوتر",
    description: "GPON Terminal with 4 GE ports + 2 POTS + Wi-Fi",
    lowStockThreshold: 10,
    isSerialized: true,
    isActive: true,
  };

  const mockNonSerializedProduct: ProductRow = {
    id: "prod-2",
    name: "Patch Cord Fiber 3m",
    sku: "CAB-FC-3M",
    model: "FC-3M",
    category: "كابلات",
    description: "Fiber patch cord 3 meters",
    lowStockThreshold: 20,
    isSerialized: false,
    isActive: true,
  };

  const mockStocks: InventoryStockRow[] = [
    {
      id: "stock-1",
      itemId: "prod-2",
      itemName: "Patch Cord Fiber 3m",
      model: "FC-3M",
      category: "كابلات",
      warehouseId: "wh-1",
      warehouseName: "المخزن الرئيسي",
      quantity: 5, // low stock!
      lowStockThreshold: 20,
    },
  ];

  const mockMovements: InventoryMovementRow[] = [
    {
      id: "mov-1",
      itemId: "prod-2",
      itemName: "Patch Cord Fiber 3m",
      warehouseId: "wh-1",
      warehouseName: "المخزن الرئيسي",
      type: "INBOUND_SUPPLIER",
      quantity: 100,
      performedBy: "أمين المخزن",
      createdAt: "2026-03-01T10:00:00Z",
      notes: "توريد شحنة جديدة",
    },
  ];

  it("renders product attributes, SKU, and active status badge", () => {
    const html = renderToStaticMarkup(
      <ProductDetail
        product={mockNonSerializedProduct}
        stocks={mockStocks}
        movements={mockMovements}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("Patch Cord Fiber 3m");
    expect(html).toContain("CAB-FC-3M");
    expect(html).toContain("FC-3M");
    expect(html).toContain("كابلات");
    expect(html).toContain("نشط");
    expect(html).toContain("العودة إلى كتالوج الأصناف");
  });

  it("displays Phase 4 serialized guardrail banner directing to Routers Module", () => {
    const html = renderToStaticMarkup(
      <ProductDetail
        product={mockSerializedProduct}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("صنف خاضع للتتبع الفردي برقم السيريال (Serial Number)");
    expect(html).toContain("يمنع النظام الحركات الكمية المجردة عليه لحماية دورة حياة العهدة والتتبع");
    expect(html).toContain("الانتقال إلى شاشة إدارة الراوترات");
    expect(html).toContain("href=\"/routers-preview\"");
  });

  it("displays low-stock warning banner when total stock is below threshold", () => {
    const html = renderToStaticMarkup(
      <ProductDetail
        product={mockNonSerializedProduct}
        stocks={mockStocks}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("تنبيه انخفاض المخزون");
    expect(html).toContain("مخزون منخفض");
  });

  it("renders stock distribution and movements tabs", () => {
    const html = renderToStaticMarkup(
      <ProductDetail
        product={mockNonSerializedProduct}
        stocks={mockStocks}
        movements={mockMovements}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("توزيع الرصيد عبر المخازن (1)");
    expect(html).toContain("سجل الحركات الخاصة بالصنف (1)");
    expect(html).toContain("المخزن الرئيسي");
  });

  it("renders Edit and Deactivate buttons when authorized", () => {
    const html = renderToStaticMarkup(
      <ProductDetail
        product={mockNonSerializedProduct}
        canManage={true}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />
    );

    expect(html).toContain("تعديل الصنف");
    expect(html).toContain("تعطيل الصنف");
  });
});
