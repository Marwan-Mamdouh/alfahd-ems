import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AttendanceFilters,
  EMPTY_ATTENDANCE_FILTERS,
  ATTENDANCE_DEPARTMENTS,
  ATTENDANCE_STATUS_OPTIONS,
} from "../attendance-filters";

describe("AttendanceFilters", () => {
  it("renders all filter controls with accessible labels", () => {
    const html = renderToStaticMarkup(
      <AttendanceFilters
        value={EMPTY_ATTENDANCE_FILTERS}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("البحث عن موظف");
    expect(html).toContain("من تاريخ");
    expect(html).toContain("إلى تاريخ");
    expect(html).toContain("القسم");
    expect(html).toContain("حالة الحضور");

    // All departments rendered
    for (const dept of ATTENDANCE_DEPARTMENTS) {
      expect(html).toContain(dept.label);
    }

    // All statuses rendered
    for (const status of ATTENDANCE_STATUS_OPTIONS) {
      expect(html).toContain(status.label);
    }
  });

  it("shows date range error message when dateFrom is after dateTo", () => {
    const html = renderToStaticMarkup(
      <AttendanceFilters
        value={{
          ...EMPTY_ATTENDANCE_FILTERS,
          dateFrom: "2026-10-20",
          dateTo: "2026-10-10",
        }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.");
    expect(html).toContain('data-testid="attendance-date-range-error"');
  });

  it("renders clear filters button when active filters exist", () => {
    const html = renderToStaticMarkup(
      <AttendanceFilters
        value={{
          ...EMPTY_ATTENDANCE_FILTERS,
          department: "TECHNICAL",
        }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("مسح الفلاتر");
    expect(html).toContain('data-testid="attendance-clear-filters-btn"');
  });

  it("does not render clear filters button when all filters are empty", () => {
    const html = renderToStaticMarkup(
      <AttendanceFilters
        value={EMPTY_ATTENDANCE_FILTERS}
        onChange={vi.fn()}
      />
    );

    expect(html).not.toContain("مسح الفلاتر");
  });
});
