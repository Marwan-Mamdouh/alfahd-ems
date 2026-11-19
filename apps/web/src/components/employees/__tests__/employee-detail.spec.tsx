import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeDetail } from "../employee-detail";
import type { EmployeeRow } from "../types";

describe("EmployeeDetail Component (Task F1 / Issue #82)", () => {
  const mockEmployee: EmployeeRow = {
    id: "emp-det-1",
    name: "مروان محمود",
    email: "marwan@company.local",
    phone: "01033221100",
    nationalId: "29201011234567",
    hireDate: "2023-05-10",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    warehouseId: "wh-1",
    warehouseName: "المخزن الرئيسي (القاهرة)",
    status: "ACTIVE",
    createdAt: "2023-05-10T09:00:00Z",
    statusChanges: [
      {
        from: "ON_LEAVE",
        to: "ACTIVE",
        reason: "العودة من إجازة الحج السنوية",
        changedAt: "2024-07-01T08:00:00Z",
      },
    ],
  };

  it("renders loading state when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeDetail employee={null} isLoading={true} />
    );

    expect(html).toContain("animate-spin");
  });

  it("renders error state when error is passed", () => {
    const html = renderToStaticMarkup(
      <EmployeeDetail
        employee={null}
        error={new Error("تعذر تحميل ملف الموظف")}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("تعذر تحميل ملف الموظف");
    expect(html).toContain("إعادة المحاولة");
  });

  it("renders empty state when employee is null", () => {
    const html = renderToStaticMarkup(
      <EmployeeDetail employee={null} />
    );

    expect(html).toContain("لم يتم العثور على الموظف");
  });

  it("renders full profile information with identity, assignment, and status badges", () => {
    const html = renderToStaticMarkup(
      <EmployeeDetail
        employee={mockEmployee}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
      />
    );

    expect(html).toContain("مروان محمود");
    expect(html).toContain("marwan@company.local");
    expect(html).toContain("01033221100");
    expect(html).toContain("29201011234567");
    expect(html).toContain("فني ميداني");
    expect(html).toContain("القسم الفني");
    expect(html).toContain("المخزن الرئيسي (القاهرة)");
    expect(html).toContain("نشط");
    expect(html).toContain("سجل تدقيق تغييرات الحالة");
    expect(html).toContain("العودة من إجازة الحج السنوية");
    expect(html).toContain("العودة لقائمة الموظفين");
  });

  it("respects permission flags by hiding edit and status action buttons when restricted", () => {
    const htmlWithPermissions = renderToStaticMarkup(
      <EmployeeDetail
        employee={mockEmployee}
        canEdit={true}
        canChangeStatus={true}
        canUploadPhoto={true}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
      />
    );
    expect(htmlWithPermissions).toContain("تعديل البيانات");
    expect(htmlWithPermissions).toContain("تغيير الحالة");

    const htmlWithoutPermissions = renderToStaticMarkup(
      <EmployeeDetail
        employee={mockEmployee}
        canEdit={false}
        canChangeStatus={false}
        canUploadPhoto={false}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
      />
    );
    expect(htmlWithoutPermissions).not.toContain("تعديل البيانات");
    expect(htmlWithoutPermissions).not.toContain("تغيير الحالة");
  });
});
