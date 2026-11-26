import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceTotalsCards } from "../attendance-totals-cards";
import type { AttendanceTotals } from "../types";

describe("AttendanceTotalsCards (Cross-Page Totals Presentation)", () => {
  const sampleTotals: AttendanceTotals = {
    total: 150,
    onTime: 120,
    late: 30,
  };

  it("renders server-provided totals truthfully with cross-page context labels", () => {
    const html = renderToStaticMarkup(
      <AttendanceTotalsCards totals={sampleTotals} />
    );

    expect(html).toContain("إجمالي السجلات المطابقة");
    expect(html).toContain("شامل لكافة الصفحات بالمرشحات الحالية");
    expect(html).toContain("في الموعد");
    expect(html).toContain("مطابق لشرط الحضور في الوقت المحدد");
    expect(html).toContain("المتأخرون");
    expect(html).toContain("حالات الحضور المسجلة بعد الموعد");

    // Formatted in Arabic locale
    expect(html).toContain((150).toLocaleString("ar-EG"));
    expect(html).toContain((120).toLocaleString("ar-EG"));
    expect(html).toContain((30).toLocaleString("ar-EG"));
  });

  it("prioritizes filteredTotal when provided from the server", () => {
    const html = renderToStaticMarkup(
      <AttendanceTotalsCards totals={sampleTotals} filteredTotal={42} />
    );

    expect(html).toContain((42).toLocaleString("ar-EG"));
  });

  it("renders loading skeleton state when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <AttendanceTotalsCards totals={sampleTotals} isLoading={true} />
    );

    expect(html).toContain("animate-pulse");
  });

  it("handles zero and empty totals safely without crashing", () => {
    const html = renderToStaticMarkup(
      <AttendanceTotalsCards totals={{ total: 0, onTime: 0, late: 0 }} />
    );

    expect(html).toContain("إجمالي السجلات المطابقة");
    expect(html).toContain((0).toLocaleString("ar-EG"));
  });
});
