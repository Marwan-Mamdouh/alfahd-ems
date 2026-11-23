import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AttendanceStatusBadge,
  getAttendanceStatusLabel,
} from "../attendance-status-badge";

describe("AttendanceStatusBadge", () => {
  it("renders 'في الموعد' with teal badge for ON_TIME status", () => {
    const html = renderToStaticMarkup(<AttendanceStatusBadge status="ON_TIME" />);
    expect(html).toContain("في الموعد");
    expect(html).toContain("bg-teal-50");
    expect(html).toContain("text-teal-700");
    expect(html).toContain('data-testid="attendance-status-ON_TIME"');
  });

  it("renders 'متأخر' with amber badge for LATE status", () => {
    const html = renderToStaticMarkup(<AttendanceStatusBadge status="LATE" />);
    expect(html).toContain("متأخر");
    expect(html).toContain("bg-amber-50");
    expect(html).toContain("text-amber-700");
    expect(html).toContain('data-testid="attendance-status-LATE"');
  });

  it("returns correct labels via getAttendanceStatusLabel", () => {
    expect(getAttendanceStatusLabel("ON_TIME")).toBe("في الموعد");
    expect(getAttendanceStatusLabel("LATE")).toBe("متأخر");
  });
});
