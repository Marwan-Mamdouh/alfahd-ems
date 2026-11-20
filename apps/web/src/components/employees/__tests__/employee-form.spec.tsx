import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeForm } from "../employee-form";
import type { EmployeeRow } from "../types";

describe("EmployeeForm Component (Backward-Compatible Wrapper)", () => {
  const mockWarehouses = [
    { id: "wh-1", name: "المخزن الرئيسي" },
  ];

  it("renders create form when no employee prop is passed", () => {
    const html = renderToStaticMarkup(
      <EmployeeForm
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("إضافة موظف جديد");
    expect(html).toContain("الاسم بالكامل");
    expect(html).toContain("example@company.com");
    expect(html).toContain("الرقم القومي (14 رقماً)");
    expect(html).toContain("تاريخ التعيين");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("إضافة الموظف");
  });

  it("renders edit form with locked fields for email and role when employee prop is provided", () => {
    const mockEmployee: EmployeeRow = {
      id: "emp-legacy-1",
      name: "حازم إمام",
      email: "hazem@company.local",
      phone: "01055443322",
      nationalId: "29001011234567",
      hireDate: "2024-01-01",
      department: "TECHNICAL",
      role: "TECHNICIAN",
      warehouseId: "wh-1",
      warehouseName: "المخزن الرئيسي",
      status: "ACTIVE",
    };

    const html = renderToStaticMarkup(
      <EmployeeForm
        employee={mockEmployee}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تعديل بيانات موظف");
    expect(html).toContain("حازم إمام");
    expect(html).toContain("hazem@company.local");
    expect(html).toContain("تعديل البريد الإلكتروني والدور الوظيفي مقفل في واجهة التعديل");
    expect(html).toContain("حفظ التعديلات");
  });
});
