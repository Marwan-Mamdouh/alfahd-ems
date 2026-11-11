import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDeactivateDialog } from "../product-deactivate-dialog";
import { InventoryItemsTable } from "../inventory-items-table";
import type { InventoryItemRow } from "../types";

describe("ProductDeactivateDialog & Deactivation UX", () => {
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

  const mockInactiveItem: InventoryItemRow = {
    id: "item-2",
    name: "Legacy Drop Cable",
    sku: "CAB-LEGACY",
    model: "LC-100",
    category: "كابلات",
    description: "Discontinued cable spool",
    lowStockThreshold: 5,
    isSerialized: false,
    isActive: false,
  };

  describe("ProductDeactivateDialog", () => {
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
      expect(html).toContain("No-Hard-Delete Compliance");
      expect(html).toContain("تأكيد التعطيل");
      expect(html).toContain("إلغاء");
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
    });
  });

  describe("InventoryItemsTable Deactivation Semantics", () => {
    it("displays 'نشط' status badge for active products", () => {
      const html = renderToStaticMarkup(
        <InventoryItemsTable items={[mockActiveItem]} />
      );

      expect(html).toContain("نشط");
      expect(html).not.toContain("معطّل / مؤرشف");
    });

    it("displays 'معطّل / مؤرشف' badge for inactive products", () => {
      const html = renderToStaticMarkup(
        <InventoryItemsTable items={[mockInactiveItem]} />
      );

      expect(html).toContain("معطّل / مؤرشف");
    });

    it("displays 'تعطيل' action button only when canDeactivate is true and product is active", () => {
      const htmlWithPermission = renderToStaticMarkup(
        <InventoryItemsTable
          items={[mockActiveItem, mockInactiveItem]}
          canDeactivate={true}
          onDeactivate={vi.fn()}
        />
      );

      // Should contain deactivation button for the active item
      expect(htmlWithPermission).toContain("تعطيل صنف Fiber Router AX1800");
      // Should NOT contain deactivation button for the already inactive item
      expect(htmlWithPermission).not.toContain("تعطيل صنف Legacy Drop Cable");
      // Hard delete button must never exist
      expect(htmlWithPermission).not.toContain("حذف صنف");
    });

    it("hides 'تعطيل' action button when canDeactivate is false", () => {
      const htmlWithoutPermission = renderToStaticMarkup(
        <InventoryItemsTable
          items={[mockActiveItem]}
          canDeactivate={false}
          onDeactivate={vi.fn()}
        />
      );

      expect(htmlWithoutPermission).not.toContain("تعطيل صنف");
    });
  });
});

