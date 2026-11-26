import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterForm } from "../router-form";

describe("RouterForm Component", () => {
  const mockProducts = [
    { id: "prod-1", name: "TP-Link Archer AX10", sku: "TPL-AX10" },
    { id: "prod-2", name: "ZTE F670L GPON", sku: "ZTE-F670L" },
  ];

  const mockWarehouses = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الإسكندرية" },
  ];

  it("renders form fields including products, warehouses, and serial input", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تسجيل جهاز راوتر جديد");
    expect(html).toContain("الرقم التسلسلي (Serial Number)");
    expect(html).toContain("نوع وموديل الراوتر (كتالوج المنتجات)");
    expect(html).toContain("TP-Link Archer AX10");
    expect(html).toContain("المخزن المستلم");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("الحالة الفيزيائية الابتدائية");
  });

  it("displays new receipt mode explanation by default", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("استلام شحنة جديدة من المورد");
    expect(html).toContain("زيادة رصيد المخزن تلقائياً (+1 وارد مورد)");
  });

  it("displays existing stock mode explanation when initialValues sets isNewReceipt to false", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        initialValues={{
          serialNumber: "SN-EXISTING-01",
          productId: "prod-1",
          warehouseId: "wh-1",
          physicalCondition: "SERVICEABLE",
          isNewReceipt: false,
          notes: "",
        }}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تسجيل من رصيد المخزن الحالي");
    expect(html).toContain("حجز جهاز من الرصيد المسجل مسبقًا (+0 تغيير) مع فحص سعة المخزن المتاحة.");
  });

  it("displays inventory deduction warning when registered as DAMAGED under existing stock", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        initialValues={{
          serialNumber: "SN-DAMAGED-01",
          productId: "prod-1",
          warehouseId: "wh-1",
          physicalCondition: "DAMAGED",
          isNewReceipt: false,
          notes: "تلف في منفذ الطاقة",
        }}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تسجيل جهاز تالف من الرصيد الحالي سيقوم بخصم 1 من رصيد المخزن");
  });

  it("renders server error alert when serverError is provided", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        serverError="الرقم التسلسلي مسجل مسبقاً في النظام (Conflict 409)"
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("الرقم التسلسلي مسجل مسبقاً في النظام (Conflict 409)");
  });

  it("renders field error when fieldErrors is provided", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        fieldErrors={{
          serialNumber: "الرقم التسلسلي يجب ألا يقل عن 4 أحرف",
        }}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("الرقم التسلسلي يجب ألا يقل عن 4 أحرف");
  });

  it("disables submit button and shows loading indicator when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <RouterForm
        products={mockProducts}
        warehouses={mockWarehouses}
        isSubmitting={true}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("جاري التسجيل...");
    expect(html).toContain("disabled");
  });
});
