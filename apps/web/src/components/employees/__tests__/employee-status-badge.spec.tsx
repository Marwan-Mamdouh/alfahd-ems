import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EmployeeStatusBadge,
  getEmployeeStatusLabel,
  EMPLOYEE_STATUS_OPTIONS,
} from "../employee-status-badge";

describe("EmployeeStatusBadge Component (Task F1 / Issue #82)", () => {
  it("renders ACTIVE status badge with correct Arabic label and styling", () => {
    const html = renderToStaticMarkup(<EmployeeStatusBadge status="ACTIVE" />);
    expect(html).toContain("نشط");
    expect(html).toContain("data-status=\"ACTIVE\"");
    expect(html).toContain("bg-teal-600");
  });

  it("renders ON_LEAVE status badge with correct Arabic label and styling", () => {
    const html = renderToStaticMarkup(<EmployeeStatusBadge status="ON_LEAVE" />);
    expect(html).toContain("في إجازة");
    expect(html).toContain("data-status=\"ON_LEAVE\"");
    expect(html).toContain("bg-amber-600");
  });

  it("renders INACTIVE status badge with correct Arabic label and styling", () => {
    const html = renderToStaticMarkup(<EmployeeStatusBadge status="INACTIVE" />);
    expect(html).toContain("غير نشط");
    expect(html).toContain("data-status=\"INACTIVE\"");
    expect(html).toContain("bg-red-500");
  });

  it("translates all statuses via getEmployeeStatusLabel helper", () => {
    expect(getEmployeeStatusLabel("ACTIVE")).toBe("نشط");
    expect(getEmployeeStatusLabel("ON_LEAVE")).toBe("في إجازة");
    expect(getEmployeeStatusLabel("INACTIVE")).toBe("غير نشط");
  });

  it("exports all 3 required employee status options in EMPLOYEE_STATUS_OPTIONS", () => {
    const values = EMPLOYEE_STATUS_OPTIONS.map((opt) => opt.value);
    expect(values).toEqual(["ACTIVE", "ON_LEAVE", "INACTIVE"]);
  });
});
