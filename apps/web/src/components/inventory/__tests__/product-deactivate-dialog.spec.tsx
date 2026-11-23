import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDeactivateDialog } from "../product-deactivate-dialog";
import type { InventoryItemRow } from "../types";

describe("ProductDeactivateDialog & B7/#81 Deactivation UX", () => {
  const mockActiveItem: InventoryItemRow = {
    id: "item-1",
    name: "Fiber Router AX1800",
    sku: "RTR-AX1800",
    model: "AX1800-V2",
    category: "راوترات",
    description: "Gigabit Wi-Fi 6 Router",
    lowStockThreshold: 10,
    isSerialized: true,
    isActive: true,
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ProductDeactivateDialog
        item={mockActiveItem}
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders dialog with item details and no-hard-delete compliance notice when open", () => {
    const html = renderToStaticMarkup(
      <ProductDeactivateDialog
        item={mockActiveItem}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("تعطيل وأرشفة الصنف");
    expect(html).toContain("Fiber Router AX1800");
    expect(html).toContain("RTR-AX1800");
    expect(html).toContain("AX1800-V2");
    expect(html).toContain("سياسة الحفاظ على البيانات (No-Hard-Delete Compliance)");
    expect(html).toContain("تأكيد التعطيل");
    expect(html).toContain("إلغاء");
    expect(html).not.toContain("حذف الصنف");
    expect(html).not.toContain("حذف نهائي");
  });

  it("renders loading state when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <ProductDeactivateDialog
        item={mockActiveItem}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("جاري التعطيل...");
    expect(html).toContain("disabled");
  });

  it("displays backend-provided 409 conflict error truthfully", () => {
    const conflictMessage =
      "Cannot deactivate product due to active inventory or active router assets";

    const html = renderToStaticMarkup(
      <ProductDeactivateDialog
        item={mockActiveItem}
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

  it("displays general error message when error prop is provided", () => {
    const html = renderToStaticMarkup(
      <ProductDeactivateDialog
        item={mockActiveItem}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        error="فشل الاتصال بخادم قاعدة البيانات"
      />
    );

    expect(html).toContain("فشل الاتصال بخادم قاعدة البيانات");
  });
});
