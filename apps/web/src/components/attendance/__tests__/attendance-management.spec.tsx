import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceManagement } from "../attendance-management";
import { EMPTY_ATTENDANCE_FILTERS } from "../attendance-filters";
import type { AttendanceLoadState, AttendanceRow } from "../types";

describe("AttendanceManagement (Unified Component & Quality Assurance)", () => {
  const mockRecord: AttendanceRow = {
    id: "att-ready-1",
    userId: "emp-99",
    employeeName: "كريم يوسف",
    department: "MANAGEMENT",
    workDate: "2026-10-15",
    checkInAt: "2026-10-15T08:00:00+03:00",
    checkOutAt: "2026-10-15T16:00:00+03:00",
    checkInDistanceM: 5,
    hoursWorked: 8.0,
    status: "ON_TIME",
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
  };

  const readyState: AttendanceLoadState = {
    kind: "ready",
    value: {
      page: {
        items: [mockRecord],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      totals: {
        total: 1,
        onTime: 1,
        late: 0,
      },
    },
  };

  it("renders header, summary cards, filter bar, and table in ready state", () => {
    const html = renderToStaticMarkup(
      <AttendanceManagement
        data={readyState}
        filter={EMPTY_ATTENDANCE_FILTERS}
        capabilities={{ view: true, override: true, export: true }}
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("إدارة الحضور والانصراف");
    expect(html).toContain("تصدير تقرير Excel");
    expect(html).toContain("إجمالي السجلات المطابقة");
    expect(html).toContain("كريم يوسف");
    expect(html).toContain("MANAGEMENT");
    expect(html).toContain('data-testid="attendance-management"');
  });

  it("respects export capability by hiding export button when export is false", () => {
    const html = renderToStaticMarkup(
      <AttendanceManagement
        data={readyState}
        filter={EMPTY_ATTENDANCE_FILTERS}
        capabilities={{ view: true, override: true, export: false }}
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(html).not.toContain("تصدير تقرير Excel");
    expect(html).not.toContain('data-testid="open-export-dialog-btn"');
  });

  it("renders error banner with retry button in error state", () => {
    const errorState: AttendanceLoadState = {
      kind: "error",
      message: "فشل تحميل البيانات من الخادم (500 Internal Server Error)",
      retry: vi.fn(),
    };

    const html = renderToStaticMarkup(
      <AttendanceManagement
        data={errorState}
        filter={EMPTY_ATTENDANCE_FILTERS}
        capabilities={{ view: true, override: true, export: true }}
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("فشل تحميل البيانات من الخادم (500 Internal Server Error)");
    expect(html).toContain("إعادة المحاولة");
    expect(html).toContain('data-testid="attendance-retry-btn"');
  });
});
