import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeePhotoDialog } from "../employee-photo-dialog";
import type { EmployeeRow } from "../types";

describe("EmployeePhotoDialog Component (Task F1 / Issue #82)", () => {
  const mockEmployee: EmployeeRow = {
    id: "emp-photo-1",
    name: "ياسر كمال",
    email: "yasser@company.local",
    phone: "01000000002",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    status: "ACTIVE",
    profilePhotoUrl: "https://example.com/photos/yasser.jpg",
  };

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EmployeePhotoDialog
        employee={mockEmployee}
        isOpen={false}
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(html).toBe("");
  });

  it("renders photo upload dialog with employee name and current photo", () => {
    const html = renderToStaticMarkup(
      <EmployeePhotoDialog
        employee={mockEmployee}
        isOpen={true}
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(html).toContain("تحديث الصورة الشخصية");
    expect(html).toContain("ياسر كمال");
    expect(html).toContain("https://example.com/photos/yasser.jpg");
    expect(html).toContain("الصورة الحالية للموظف");
    expect(html).toContain("تحديد ملف صورة");
    expect(html).toContain("صيغ المدعومة: JPEG, PNG, WebP (الحد الأقصى: 5 ميجابايت)");
  });

  it("renders error message banner when error is passed", () => {
    const html = renderToStaticMarkup(
      <EmployeePhotoDialog
        employee={mockEmployee}
        isOpen={true}
        errorMessage="حجم الملف يتجاوز الحد المسموح به"
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(html).toContain("حجم الملف يتجاوز الحد المسموح به");
  });

  it("disables upload and displays spinner when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EmployeePhotoDialog
        employee={mockEmployee}
        isOpen={true}
        isSubmitting={true}
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(html).toContain("disabled");
  });
});
