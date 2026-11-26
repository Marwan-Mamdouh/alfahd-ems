import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryItemForm } from "../inventory-item-form";
import type { ProductRow } from "../types";

describe("InventoryItemForm Component (Product Creation & Edit)", () => {
  const mockProduct: ProductRow = {
    id: "prod-1",
    name: "كابل فايبر أحادي النمط",
    sku: "FBR-SM-100",
    model: "SM-100M",
    category: "كابلات وأسلاك",
    description: "لفة كابل فايبر 100 متر عالية الجودة",
    lowStockThreshold: 15,
    isSerialized: false,
    isActive: true,
  };

  it("renders create form in Arabic RTL with default lowStockThreshold", () => {
    const html = renderToStaticMarkup(
      <InventoryItemForm
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("إضافة صنف جديد للكتالوج");
    expect(html).toContain("اسم الصنف *");
    expect(html).toContain("رمز الصنف (SKU) *");
    expect(html).toContain("الموديل / الطراز *");
    expect(html).toContain("التصنيف *");
    expect(html).toContain("حد انخفاض المخزون (تنبيه إعادة الطلب) *");
    expect(html).toContain("10"); // default threshold
    expect(html).toContain('dir="rtl"');
  });

  it("renders edit form pre-populated with product attributes", () => {
    const html = renderToStaticMarkup(
      <InventoryItemForm
        item={mockProduct}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تعديل بيانات الصنف");
    expect(html).toContain("كابل فايبر أحادي النمط");
    expect(html).toContain("FBR-SM-100");
    expect(html).toContain("SM-100M");
    expect(html).toContain("كابلات وأسلاك");
    expect(html).toContain("15");
    expect(html).toContain("حفظ التعديلات");
  });

  it("disables fields and submit button while submitting to prevent duplicate submissions", () => {
    const html = renderToStaticMarkup(
      <InventoryItemForm
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
      <InventoryItemForm
        item={mockProduct}
        onSubmit={vi.fn()}
        serverError="رمز الصنف (SKU) مسجل مسبقًا لصنف آخر"
      />
    );

    expect(html).toContain("رمز الصنف (SKU) مسجل مسبقًا لصنف آخر");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("FBR-SM-100");
  });

  it("displays field errors when provided", () => {
    const html = renderToStaticMarkup(
      <InventoryItemForm
        onSubmit={vi.fn()}
        fieldErrors={{
          sku: "رمز الصنف يجب ألا يتجاوز 100 حرف",
          lowStockThreshold: "حد انخفاض المخزون يجب أن يكون رقمًا صحيحًا غير سالب",
        }}
      />
    );

    expect(html).toContain("رمز الصنف يجب ألا يتجاوز 100 حرف");
    expect(html).toContain("حد انخفاض المخزون يجب أن يكون رقمًا صحيحًا غير سالب");
  });
});
