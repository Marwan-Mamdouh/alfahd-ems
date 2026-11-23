import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseDeactivateDialog } from "../warehouse-deactivate-dialog";
import type { WarehouseRow } from "../types";

describe("WarehouseDeactivateDialog Component (Criterion E Compliance)", () => {
  const mockWarehouse: WarehouseRow = {
    id: "wh-alex-1",
    name: "مستودع سموحة بالإسكندرية",
    address: "طريق 14 مايو، سموحة، الإسكندرية",
    latitude: 31.2156,
    longitude: 29.9553,
    geofenceRadiusMeters: 150,
    managerId: "mgr-1",
    isActive: true,
  };

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <WarehouseDeactivateDialog
        warehouse={mockWarehouse}
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toBe("");
  });

  it("renders accessible dialog with deactivate terminology and no-delete compliance", () => {
    const html = renderToStaticMarkup(
      <WarehouseDeactivateDialog
        warehouse={mockWarehouse}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("role=\"dialog\"");
    expect(html).toContain("aria-modal=\"true\"");
    expect(html).toContain("تعطيل المخزن: مستودع سموحة بالإسكندرية");
    expect(html).toContain("طريق 14 مايو، سموحة، الإسكندرية");
    expect(html).toContain("تأكيد التعطيل");
    expect(html).toContain("إلغاء");
    // Verify soft-deactivation terminology compliance
    expect(html).toContain("تُحفظ كافة السجلات التاريخية السابقة دون حذف");
    expect(html).not.toContain("حذف المخزن");
    expect(html).not.toContain("حذف نهائي");
  });

  it("renders pending state when isPending is true", () => {
    const html = renderToStaticMarkup(
      <WarehouseDeactivateDialog
        warehouse={mockWarehouse}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={true}
      />
    );

    expect(html).toContain("جاري التعطيل...");
    expect(html).toContain("disabled");
  });

  it("displays backend-provided 409 conflict message truthfully", () => {
    const conflictMessage =
      "Cannot deactivate warehouse due to active inventory, staff, located routers, or active custody";

    const html = renderToStaticMarkup(
      <WarehouseDeactivateDialog
        warehouse={mockWarehouse}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        conflict={conflictMessage}
      />
    );

    expect(html).toContain("تعذر إتمام التعطيل (تعارض في البيانات):");
    expect(html).toContain(conflictMessage);
    expect(html).toContain("role=\"alert\"");
  });

  it("displays custom error message when error prop is provided", () => {
    const html = renderToStaticMarkup(
      <WarehouseDeactivateDialog
        warehouse={mockWarehouse}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        error="المخزن يحتوي على 14 جهاز راوتر مسجلين حاليًا"
      />
    );

    expect(html).toContain("المخزن يحتوي على 14 جهاز راوتر مسجلين حاليًا");
  });
});
