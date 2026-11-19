import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeFilters } from "../employee-filters";

describe("EmployeeFilters Component (Task F1 / Issue #82)", () => {
  const mockWarehouses = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الإسكندرية" },
  ];

  it("renders filter controls with search and dropdown selectors", () => {
    const html = renderToStaticMarkup(
      <EmployeeFilters
        value={{ search: "", department: "", role: "", status: "", warehouseId: "" }}
        onChange={vi.fn()}
        warehouses={mockWarehouses}
      />
    );

    expect(html).toContain("بحث بالاسم، البريد، أو الرقم القومي...");
    expect(html).toContain("كل الأقسام");
    expect(html).toContain("القسم الفني");
    expect(html).toContain("كل الأدوار");
    expect(html).toContain("فني ميداني (TECHNICIAN)");
    expect(html).toContain("كل الحالات");
    expect(html).toContain("في إجازة");
    expect(html).toContain("كل المخازن");
    expect(html).toContain("المخزن الرئيسي");
  });

  it("renders reset button when at least one filter has a value", () => {
    const html = renderToStaticMarkup(
      <EmployeeFilters
        value={{ search: "أحمد", department: "", role: "", status: "", warehouseId: "" }}
        onChange={vi.fn()}
        warehouses={mockWarehouses}
      />
    );

    expect(html).toContain("مسح جميع الفلاتر");
  });

  it("does not render reset button when all filters are empty", () => {
    const html = renderToStaticMarkup(
      <EmployeeFilters
        value={{ search: "", department: "", role: "", status: "", warehouseId: "" }}
        onChange={vi.fn()}
        warehouses={mockWarehouses}
      />
    );

    expect(html).not.toContain("مسح جميع الفلاتر");
  });

  it("disables all filter inputs when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeFilters
        value={{ search: "test", department: "", role: "", status: "", warehouseId: "" }}
        onChange={vi.fn()}
        warehouses={mockWarehouses}
        isLoading={true}
      />
    );

    expect(html).toContain("disabled");
  });
});
