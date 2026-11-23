import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryMovementsTable } from "../inventory-movements-table";
import type { InventoryMovementRow } from "../types";

describe("InventoryMovementsTable Component (Movement Ledger & Labels)", () => {
  const mockMovements: InventoryMovementRow[] = [
    {
      id: "mov-1",
      itemId: "prod-1",
      itemName: "راوتر TP-Link C6",
      warehouseId: "wh-1",
      warehouseName: "مخزن القاهرة",
      type: "INBOUND_SUPPLIER",
      quantity: 50,
      performedBy: "أمين المخزن",
      createdAt: "2026-03-01T10:00:00Z",
      notes: "فاتورة توريد رقم 4410",
    },
    {
      id: "mov-2",
      itemId: "prod-2",
      itemName: "كابل إيثرنت 20 متر",
      warehouseId: "wh-1",
      warehouseName: "مخزن القاهرة",
      type: "OUTBOUND_TECHNICIAN",
      quantity: 5,
      performedBy: "أمين المخزن",
      createdAt: "2026-03-02T11:30:00Z",
      notes: null,
    },
    {
      id: "mov-3",
      itemId: "prod-2",
      itemName: "كابل إيثرنت 20 متر",
      warehouseId: "wh-1",
      warehouseName: "مخزن القاهرة",
      type: "RETURN_TECHNICIAN",
      quantity: 1,
      performedBy: "أمين المخزن",
      createdAt: "2026-03-02T16:00:00Z",
      notes: "مرتجع فائض من أمر شغل",
    },
    {
      id: "mov-4",
      itemId: "prod-3",
      itemName: "محول SFP 1G",
      warehouseId: "wh-1",
      warehouseName: "مخزن القاهرة",
      type: "TRANSFER_WAREHOUSE",
      quantity: 10,
      performedBy: "مدير العمليات",
      createdAt: "2026-03-03T09:15:00Z",
      notes: "تحويل إلى مخزن الإسكندرية",
    },
    {
      id: "mov-5",
      itemId: "prod-3",
      itemName: "محول SFP 1G",
      warehouseId: "wh-1",
      warehouseName: "مخزن القاهرة",
      type: "ADJUSTMENT",
      quantity: 2,
      performedBy: "مدير النظام",
      createdAt: "2026-03-03T14:45:00Z",
      notes: "تسوية جردية بعد الجرد السنوي",
    },
  ];

  it("renders all five inventory movement types with correct Arabic labels", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementsTable
        movements={mockMovements}
      />
    );

    // 1. INBOUND_SUPPLIER
    expect(html).toContain("وارد مورد");
    // 2. OUTBOUND_TECHNICIAN
    expect(html).toContain("صرف لفني");
    // 3. RETURN_TECHNICIAN
    expect(html).toContain("مرتجع فني");
    // 4. TRANSFER_WAREHOUSE
    expect(html).toContain("تحويل مخزني");
    // 5. ADJUSTMENT
    expect(html).toContain("تسوية جردية");

    expect(html).toContain("راوتر TP-Link C6");
    expect(html).toContain("مخزن القاهرة");
    expect(html).toContain("فاتورة توريد رقم 4410");
    expect(html).toContain("تسوية جردية بعد الجرد السنوي");
  });

  it("renders empty state when movements list is empty", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementsTable
        movements={[]}
      />
    );

    expect(html).toContain("لا توجد حركات مخزون");
    expect(html).toContain("لم يتم تسجيل أي عمليات وارد أو صادر أو تحويلات بعد");
  });

  it("renders loading spinner when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementsTable
        movements={[]}
        isLoading={true}
      />
    );

    expect(html).toContain("animate-spin");
  });

  it("renders error state when error is present", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementsTable
        movements={[]}
        error="تعذر تحميل سجل الحركات المخزنية"
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("تعذر تحميل سجل الحركات المخزنية");
  });

  it("renders pagination controls when page and total are provided", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementsTable
        movements={mockMovements}
        page={1}
        pageSize={10}
        total={45}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("صفحة 1 من 5 (إجمالي 45 حركة)");
    expect(html).toContain("السابق");
    expect(html).toContain("التالي");
  });
});
