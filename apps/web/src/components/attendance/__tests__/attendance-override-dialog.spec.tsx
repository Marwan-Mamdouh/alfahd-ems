import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceOverrideDialog } from "../attendance-override-dialog";
import type { AttendanceRow } from "../types";

describe("AttendanceOverrideDialog (Admin Override & Audit Reason)", () => {
  const mockRecord: AttendanceRow = {
    id: "att-101",
    userId: "emp-1",
    employeeName: "أحمد محمد",
    department: "TECHNICAL",
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T08:30:00+03:00",
    checkOutAt: "2026-10-15T16:30:00+03:00",
    checkInDistanceM: 20,
    hoursWorked: 8.0,
    status: "LATE",
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  };

  it("renders nothing when isOpen is false or record is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <AttendanceOverrideDialog
        record={mockRecord}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(htmlClosed).toBe("");

    const htmlNull = renderToStaticMarkup(
      <AttendanceOverrideDialog
        record={null}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(htmlNull).toBe("");
  });

  it("renders employee context, status selector, and mandatory reason field when open", () => {
    const html = renderToStaticMarkup(
      <AttendanceOverrideDialog
        record={mockRecord}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("تعديل سجل الحضور (إشراف إداري)");
    expect(html).toContain("أحمد محمد");
    expect(html).toContain("TECHNICAL");
    expect(html).toContain("2026-10-15");
    expect(html).toContain("حالة الحضور المعدلة");
    expect(html).toContain("وقت الحضور المعدل");
    expect(html).toContain("وقت الانصراف المعدل");
    expect(html).toContain("سبب التعديل الإداري");
    expect(html).toContain("تأكيد التعديل");
    expect(html).toContain("إلغاء");
  });

  it("displays server error message while preserving dialog state", () => {
    const html = renderToStaticMarkup(
      <AttendanceOverrideDialog
        record={mockRecord}
        isOpen={true}
        errorMessage="خطأ في الصلاحيات: يتطلب تعديل السجل صلاحية مسؤول النظام."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("خطأ في الصلاحيات: يتطلب تعديل السجل صلاحية مسؤول النظام.");
    expect(html).toContain('data-testid="override-error-alert"');
  });

  it("renders loading state with disabled inputs during submission to prevent duplicate submits", () => {
    const html = renderToStaticMarkup(
      <AttendanceOverrideDialog
        record={mockRecord}
        isOpen={true}
        isSubmitting={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("جارٍ الحفظ...");
    expect(html).toContain("disabled");
  });
});
