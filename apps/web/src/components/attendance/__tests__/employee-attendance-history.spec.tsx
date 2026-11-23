import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeAttendanceHistory } from "../employee-attendance-history";
import type { AttendanceRow, AttendanceTotals } from "../types";

describe("EmployeeAttendanceHistory (Employee Drilldown & History)", () => {
  const mockEmployeeRecords: AttendanceRow[] = [
    {
      id: "att-hist-1",
      userId: "emp-42",
      employeeName: "طارق زياد",
      department: "TECHNICAL",
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
      id: "att-hist-2",
      userId: "emp-42",
      employeeName: "طارق زياد",
      department: "TECHNICAL",
      workDate: "2026-10-14",
      checkInAt: "2026-10-14T08:25:00+03:00",
      checkOutAt: "2026-10-14T16:00:00+03:00",
      checkInDistanceM: 15,
      hoursWorked: 7.6,
      status: "LATE",
      overrideReason: null,
      overriddenBy: null,
      overriddenAt: null,
    },
  ];

  const mockEmployeeTotals: AttendanceTotals = {
    total: 2,
    onTime: 1,
    late: 1,
  };

  it("renders employee name, department, employee ID, and back navigation button", () => {
    const html = renderToStaticMarkup(
      <EmployeeAttendanceHistory
        employeeId="emp-42"
        employeeName="طارق زياد"
        departmentName="القسم الفني"
        records={mockEmployeeRecords}
        totals={mockEmployeeTotals}
        filter={{ dateFrom: "", dateTo: "", status: "" }}
        onFilterChange={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("سجل حضور طارق زياد");
    expect(html).toContain("القسم الفني");
    expect(html).toContain("emp-42");
    expect(html).toContain("العودة لسجلات الحضور العامة");
    expect(html).toContain('data-testid="history-back-btn"');
  });

  it("renders server-provided totals for the employee", () => {
    const html = renderToStaticMarkup(
      <EmployeeAttendanceHistory
        employeeId="emp-42"
        employeeName="طارق زياد"
        records={mockEmployeeRecords}
        totals={mockEmployeeTotals}
        filter={{ dateFrom: "", dateTo: "", status: "" }}
        onFilterChange={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("إجمالي السجلات المطابقة");
    expect(html).toContain((2).toLocaleString("ar-EG"));
    expect(html).toContain("في الموعد");
    expect(html).toContain((1).toLocaleString("ar-EG"));
    expect(html).toContain("المتأخرون");
  });

  it("renders history-specific filter controls (date and status only, no department)", () => {
    const html = renderToStaticMarkup(
      <EmployeeAttendanceHistory
        employeeId="emp-42"
        employeeName="طارق زياد"
        records={mockEmployeeRecords}
        totals={mockEmployeeTotals}
        filter={{ dateFrom: "", dateTo: "", status: "" }}
        onFilterChange={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="history-date-from"');
    expect(html).toContain('data-testid="history-date-to"');
    expect(html).toContain('data-testid="history-status-select"');
    // Department selector is intentionally not present in employee-specific history
    expect(html).not.toContain('data-testid="attendance-department-select"');
  });
});
