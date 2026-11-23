import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AttendanceTable,
  formatDate,
  formatTime,
  formatWorkingHours,
} from "../attendance-table";
import type { AttendanceRow } from "../types";

describe("AttendanceTable", () => {
  const mockRecords: AttendanceRow[] = [
    {
      id: "att-1",
      userId: "emp-1",
      employeeName: "سارة أحمد",
      department: "CUSTOMER_SERVICE",
      workDate: "2026-10-15",
      checkInAt: "2026-10-15T08:00:00+03:00",
      checkOutAt: "2026-10-15T16:00:00+03:00",
      checkInDistanceM: 10,
      hoursWorked: 8.0,
      status: "ON_TIME",
      overrideReason: null,
      overriddenBy: null,
      overriddenAt: null,
    },
    {
      id: "att-2",
      userId: "emp-2",
      employeeName: "محمود خالد",
      department: "TECHNICAL",
      workDate: "2026-10-15",
      checkInAt: "2026-10-15T08:45:00+03:00",
      checkOutAt: "2026-10-15T16:00:00+03:00",
      checkInDistanceM: 20,
      hoursWorked: 7.25,
      status: "LATE",
      overrideReason: "عطل في شبكة النقل",
      overriddenBy: "Admin",
      overriddenAt: "2026-10-15T18:00:00Z",
    },
  ];

  describe("Formatting helpers", () => {
    it("formatDate handles valid date strings and invalid gracefully", () => {
      expect(formatDate("2026-10-15")).not.toBe("—");
      expect(formatDate(null)).toBe("—");
      expect(formatDate("invalid-date")).toBe("—");
    });

    it("formatTime handles ISO dates in Cairo timezone and invalid values", () => {
      expect(formatTime("2026-10-15T08:00:00Z")).not.toBe("—");
      expect(formatTime(null)).toBe("—");
      expect(formatTime("invalid-time")).toBe("—");
    });

    it("formatWorkingHours converts decimal hours or minutes to 'س د' format", () => {
      expect(formatWorkingHours(8.0)).toBe("8 س 0 د");
      expect(formatWorkingHours(7.5)).toBe("7 س 30 د");
      expect(formatWorkingHours(null, 480)).toBe("8 س 0 د");
      expect(formatWorkingHours(null, null)).toBe("—");
    });
  });

  describe("Table rendering & states", () => {
    it("renders employee rows with names, departments, hours, and status badges", () => {
      const html = renderToStaticMarkup(
        <AttendanceTable records={mockRecords} />
      );

      expect(html).toContain("سارة أحمد");
      expect(html).toContain("CUSTOMER_SERVICE");
      expect(html).toContain("محمود خالد");
      expect(html).toContain("TECHNICAL");
      expect(html).toContain("8 س 0 د");
      expect(html).toContain("7 س 15 د");
      expect(html).toContain("في الموعد");
      expect(html).toContain("متأخر");
    });

    it("displays override indicator when overrideReason is present on a record", () => {
      const html = renderToStaticMarkup(
        <AttendanceTable records={mockRecords} />
      );

      expect(html).toContain("عطل في شبكة النقل");
      expect(html).toContain('data-testid="override-indicator-att-2"');
    });

    it("renders override action button only when canOverride is true", () => {
      const htmlWithOverride = renderToStaticMarkup(
        <AttendanceTable
          records={mockRecords}
          canOverride={true}
          onOverrideClick={vi.fn()}
        />
      );

      expect(htmlWithOverride).toContain("تعديل");
      expect(htmlWithOverride).toContain('data-testid="override-row-btn-att-1"');

      const htmlWithoutOverride = renderToStaticMarkup(
        <AttendanceTable records={mockRecords} canOverride={false} />
      );

      expect(htmlWithoutOverride).not.toContain('data-testid="override-row-btn-att-1"');
    });

    it("renders forbidden state when isForbidden is true", () => {
      const html = renderToStaticMarkup(
        <AttendanceTable
          records={[]}
          isForbidden={true}
          forbiddenMessage="غير مصرح بعرض السجلات"
        />
      );

      expect(html).toContain("غير مصرح بالوصول");
      expect(html).toContain("غير مصرح بعرض السجلات");
      expect(html).toContain('data-testid="attendance-forbidden-state"');
    });

    it("renders empty state when records array is empty and not loading", () => {
      const html = renderToStaticMarkup(
        <AttendanceTable records={[]} isLoading={false} />
      );

      expect(html).toContain("لا توجد سجلات حضور");
    });

    it("renders pagination controls when total exceeds pageSize", () => {
      const html = renderToStaticMarkup(
        <AttendanceTable
          records={mockRecords}
          page={1}
          pageSize={10}
          total={45}
          onPageChange={vi.fn()}
        />
      );

      expect(html).toContain("صفحة 1 من 5");
      expect(html).toContain("إجمالي 45 سجل");
    });
  });
});
