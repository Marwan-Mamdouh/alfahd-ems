import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryFilters } from "../inventory-filters";
import type { MovementFilter, SelectOption } from "../types";

describe("InventoryFilters Component", () => {
  const mockWarehouses: SelectOption[] = [
    { id: "wh-1", name: "مخزن القاهرة" },
    { id: "wh-2", name: "مخزن الإسكندرية" },
  ];

  it("renders search, warehouse, and movement type options", () => {
    const filter: MovementFilter = {
      search: "",
      warehouseId: undefined,
      movementType: "all",
    };

    const html = renderToStaticMarkup(
      <InventoryFilters
        filter={filter}
        warehouses={mockWarehouses}
        onFilterChange={vi.fn()}
      />
    );

    expect(html).toContain("البحث في حركات المخزون");
    expect(html).toContain("كافة المخازن");
    expect(html).toContain("مخزن القاهرة");
    expect(html).toContain("مخزن الإسكندرية");
    expect(html).toContain("كافة الحركات");
    expect(html).toContain("وارد مورد");
    expect(html).toContain("صرف لفني");
    expect(html).toContain("مرتجع فني");
    expect(html).toContain("تحويل مخزني");
    expect(html).toContain("تسوية جردية");
  });

  it("renders reset button when active filters exist", () => {
    const filter: MovementFilter = {
      search: "كابل",
      warehouseId: "wh-1",
      movementType: "INBOUND_SUPPLIER",
    };

    const html = renderToStaticMarkup(
      <InventoryFilters
        filter={filter}
        warehouses={mockWarehouses}
        onFilterChange={vi.fn()}
      />
    );

    expect(html).toContain("إعادة التعيين");
  });
});
