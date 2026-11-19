import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeTable } from "../employee-table";
import type { EmployeeRow } from "../types";

describe("EmployeeTable Component (Task F1 / Issue #82)", () => {
  const mockEmployees: EmployeeRow[] = [
    {
      id: "emp-1",
      name: "أحمد مصطفى",
      email: "ahmed@example.local",
      phone: "01012345678",
      nationalId: "29501011234567",
      hireDate: "2024-01-15",
      department: "TECHNICAL",
      role: "TECHNICIAN",
      warehouseId: "wh-1",
      warehouseName: "المخزن الرئيسي",
      status: "ACTIVE",
      profilePhotoUrl: null,
    },
    {
      id: "emp-2",
      name: "سارة خليل",
      email: "sara@example.local",
      phone: null,
      department: "CUSTOMER_SERVICE",
      role: "CS",
      warehouseId: null,
      warehouseName: null,
      status: "ON_LEAVE",
      profilePhotoUrl: "https://example.com/photos/sara.jpg",
    },
  ];

  it("renders employee rows with name, email, role, warehouse, and status badges", () => {
    const html = renderToStaticMarkup(
      <EmployeeTable
        employees={mockEmployees}
        onViewDetails={vi.fn()}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
      />
    );

    expect(html).toContain("أحمد مصطفى");
    expect(html).toContain("ahmed@example.local");
    expect(html).toContain("فني ميداني");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("نشط");

    expect(html).toContain("سارة خليل");
    expect(html).toContain("sara@example.local");
    expect(html).toContain("خدمة عملاء");
    expect(html).toContain("في إجازة");
    expect(html).toContain("https://example.com/photos/sara.jpg");
  });

  it("renders loading state indicator when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeTable employees={[]} isLoading={true} />
    );

    expect(html).toContain("animate-spin");
  });

  it("renders error state with retry button when error is passed", () => {
    const html = renderToStaticMarkup(
      <EmployeeTable
        employees={[]}
        error={new Error("فشل الاتصال بالخادم")}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("فشل الاتصال بالخادم");
    expect(html).toContain("إعادة المحاولة");
  });

  it("renders empty state when data array is empty", () => {
    const html = renderToStaticMarkup(
      <EmployeeTable employees={[]} />
    );

    expect(html).toContain("لا يوجد موظفون");
    expect(html).toContain("لم يتم العثور على أي موظفين يطابقون محددات البحث الحالية.");
  });

  it("renders server pagination information and navigation controls", () => {
    const html = renderToStaticMarkup(
      <EmployeeTable
        employees={mockEmployees}
        pagination={{
          page: 2,
          pageSize: 10,
          total: 25,
          onPageChange: vi.fn(),
        }}
      />
    );

    expect(html).toContain("إجمالي النتائج:");
    expect(html).toContain("25");
    expect(html).toContain("صفحة 2 من 3");
    expect(html).toContain("السابق");
    expect(html).toContain("التالي");
  });

  it("respects permission-restricted action flags (canEdit, canChangeStatus, canUploadPhoto)", () => {
    const htmlWithActions = renderToStaticMarkup(
      <EmployeeTable
        employees={mockEmployees}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
        canEdit={true}
        canChangeStatus={true}
        canUploadPhoto={true}
      />
    );
    expect(htmlWithActions).toContain("aria-label=\"تعديل بيانات أحمد مصطفى\"");
    expect(htmlWithActions).toContain("aria-label=\"تغيير حالة أحمد مصطفى\"");
    expect(htmlWithActions).toContain("aria-label=\"تحديث صورة أحمد مصطفى\"");

    const htmlWithoutActions = renderToStaticMarkup(
      <EmployeeTable
        employees={mockEmployees}
        onEdit={vi.fn()}
        onChangeStatus={vi.fn()}
        onUploadPhoto={vi.fn()}
        canEdit={false}
        canChangeStatus={false}
        canUploadPhoto={false}
      />
    );
    expect(htmlWithoutActions).not.toContain("aria-label=\"تعديل بيانات أحمد مصطفى\"");
    expect(htmlWithoutActions).not.toContain("aria-label=\"تغيير حالة أحمد مصطفى\"");
    expect(htmlWithoutActions).not.toContain("aria-label=\"تحديث صورة أحمد مصطفى\"");
  });
});
