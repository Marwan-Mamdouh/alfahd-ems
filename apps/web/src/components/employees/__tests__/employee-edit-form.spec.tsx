import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeEditForm } from "../employee-edit-form";
import type { EmployeeRow } from "../types";

describe("EmployeeEditForm Component (Task F1 / Issue #82)", () => {
  const mockEmployee: EmployeeRow = {
    id: "emp-edit-1",
    name: "طارق سليم",
    email: "tarek@company.local",
    phone: "01099887766",
    nationalId: "29402031234567",
    hireDate: "2024-02-01",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    assignedWarehouseId: "wh-1",
    warehouseId: "wh-1",
    warehouseName: "المخزن الرئيسي",
    status: "ACTIVE",
  };

  const mockWarehouses = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الإسكندرية" },
  ];

  it("renders editable fields with initial employee values", () => {
    const html = renderToStaticMarkup(
      <EmployeeEditForm
        employee={mockEmployee}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تعديل بيانات الموظف");
    expect(html).toContain("طارق سليم");
    expect(html).toContain("01099887766");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("حفظ التعديلات");
  });

  it("displays read-only security card for identity fields (email, role, nationalId, hireDate)", () => {
    const html = renderToStaticMarkup(
      <EmployeeEditForm
        employee={mockEmployee}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("بيانات الهوية والصلاحيات (غير قابلة للتعديل المباشر)");
    expect(html).toContain("tarek@company.local");
    expect(html).toContain("TECHNICIAN");
    expect(html).toContain("29402031234567");
    expect(html).toContain("البريد الإلكتروني والدور والرقم القومي محمية لمنع اختراق الهوية");
  });

  it("does not offer editable inputs for email or role", () => {
    const html = renderToStaticMarkup(
      <EmployeeEditForm
        employee={mockEmployee}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    // There should NOT be an <input name="email"> or editable email field in the editable section
    expect(html).not.toContain("name=\"email\"");
    expect(html).not.toContain("id=\"edit-emp-email\"");
  });

  it("initializes warehouse selection from backend assignedWarehouseId field", () => {
    const employeeWithAssignedWarehouse: EmployeeRow = {
      ...mockEmployee,
      warehouseId: undefined,
      assignedWarehouseId: "wh-2",
      warehouseName: "مخزن الإسكندرية",
    };

    const html = renderToStaticMarkup(
      <EmployeeEditForm
        employee={employeeWithAssignedWarehouse}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("wh-2");
  });

  it("prevents double submission by disabling buttons when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeEditForm
        employee={mockEmployee}
        warehouses={mockWarehouses}
        onSubmit={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("جاري الحفظ...");
    expect(html).toContain("disabled");
  });
});
