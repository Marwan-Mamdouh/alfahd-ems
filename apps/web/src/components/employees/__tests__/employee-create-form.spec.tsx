import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeCreateForm } from "../employee-create-form";

describe("EmployeeCreateForm Component (Task F1 / Issue #82)", () => {
  const mockWarehouses = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الإسكندرية" },
  ];

  it("renders create employee form with all required and optional input fields", () => {
    const html = renderToStaticMarkup(
      <EmployeeCreateForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("إضافة موظف جديد");
    expect(html).toContain("الاسم الكامل");
    expect(html).toContain("البريد الإلكتروني");
    expect(html).toContain("الدور الوظيفي");
    expect(html).toContain("القسم");
    expect(html).toContain("رقم الهاتف");
    expect(html).toContain("الرقم القومي (14 رقماً)");
    expect(html).toContain("تاريخ التعيين");
    expect(html).toContain("المخزن التابع له");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("الصورة الشخصية (اختياري)");
    expect(html).toContain("إضافة الموظف");
  });

  it("renders photo upload specifications and accepted formats", () => {
    const html = renderToStaticMarkup(
      <EmployeeCreateForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("صيغ مدعومة: JPEG, PNG");
    expect(html).not.toContain("WebP");
    expect(html).toContain("5 ميجابايت");
  });

  it("provides warehouse selection matching backend assignedWarehouseId schema", () => {
    const html = renderToStaticMarkup(
      <EmployeeCreateForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("المخزن التابع له");
    expect(html).toContain("wh-1");
    expect(html).toContain("wh-2");
  });

  it("prevents double submission by disabling buttons and inputs when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeCreateForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("جاري الإضافة...");
    expect(html).toContain("disabled");
  });

  it("renders cancel button and allows closing form", () => {
    const html = renderToStaticMarkup(
      <EmployeeCreateForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("إلغاء");
  });
});
