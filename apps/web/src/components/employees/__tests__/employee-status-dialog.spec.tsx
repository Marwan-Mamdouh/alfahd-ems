import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeStatusDialog } from "../employee-status-dialog";
import type { EmployeeRow } from "../types";

describe("EmployeeStatusDialog Component (Task F1 / Issue #82)", () => {
  const mockEmployee: EmployeeRow = {
    id: "emp-status-1",
    name: "حسام حسن",
    email: "hossam@company.local",
    phone: "01000000001",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    status: "ACTIVE",
  };

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toBe("");
  });

  it("renders status change dialog with employee info and status options", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تغيير حالة الموظف");
    expect(html).toContain("حسام حسن");
    expect(html).toContain("الحالة الجديدة");
    expect(html).toContain("سبب تغيير الحالة");
    expect(html).toContain("هذا السبب إلزامي طبقاً لسياسات تدقيق وتوثيق تغييرات الموظفين");
    expect(html).toContain("تأكيد التغيير");
  });

  it("renders consequence notice for ON_LEAVE transition", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={true}
        initialNewStatus="ON_LEAVE"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("إجازة رسمية (ON_LEAVE)");
    expect(html).toContain("يتم تعليق إسناد المهام وجداول العمل مؤقتاً");
  });

  it("renders critical session revocation consequence notice when transitioning to INACTIVE", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={true}
        initialNewStatus="INACTIVE"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تحذير أمني: إنهاء الجلسات النشطة (Revoke Active Sessions)");
    expect(html).toContain("إلغاء كافة الرموز المميزة (Refresh Tokens)");
  });

  it("renders error message banner when passed", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={true}
        errorMessage="فشل تحديث الحالة: سبب التغيير غير كافٍ"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("فشل تحديث الحالة: سبب التغيير غير كافٍ");
  });

  it("disables submit and displays loader when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusDialog
        employee={mockEmployee}
        isOpen={true}
        isSubmitting={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("جاري التحديث...");
    expect(html).toContain("animate-spin");
  });
});
