import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterReportControl } from "../router-report-control";

describe("RouterReportControl Component", () => {
  it("renders export button and title when canExport is true", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl canExport={true} onExport={vi.fn()} />
    );

    expect(html).toContain("تصدير تقارير الأجهزة والراوترات");
    expect(html).toContain("تصدير التقرير");
    expect(html).not.toContain("ليس لديك الصلاحيات الكافية");
  });

  it("renders permission warning and disables export when canExport is false", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl canExport={false} onExport={vi.fn()} />
    );

    expect(html).toContain("ليس لديك الصلاحيات الكافية لتصدير تقارير أجهزة الراوتر");
    expect(html).not.toContain("تصدير التقرير");
  });

  it("renders QUEUED status banner when job is queued", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl
        canExport={true}
        job={{ status: "QUEUED" }}
        onExport={vi.fn()}
      />
    );

    expect(html).toContain("طلب التصدير في طابور المعالجة (QUEUED)");
    expect(html).toContain("تم إرسال الطلب لخادم المعالجة");
  });

  it("renders RUNNING status banner with progress indicator", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl
        canExport={true}
        job={{ status: "RUNNING", progress: 75 }}
        onExport={vi.fn()}
      />
    );

    expect(html).toContain("جاري تجهيز التقرير (RUNNING)...");
    expect(html).toContain("75%");
  });

  it("renders COMPLETED status banner with active download button when downloadUrl is provided", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl
        canExport={true}
        job={{
          status: "COMPLETED",
          progress: 100,
          downloadUrl: "https://api.alfahd.local/reports/download/routers-2026.xlsx",
        }}
        onExport={vi.fn()}
      />
    );

    expect(html).toContain("تم تجهيز التقرير بنجاح (COMPLETED)");
    expect(html).toContain("تحميل التقرير");
    expect(html).toContain("https://api.alfahd.local/reports/download/routers-2026.xlsx");
    expect(html).not.toContain("الرابط غير متوفر");
  });

  it("renders disabled download button when COMPLETED but downloadUrl is missing or empty", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl
        canExport={true}
        job={{
          status: "COMPLETED",
          progress: 100,
          downloadUrl: "",
        }}
        onExport={vi.fn()}
      />
    );

    expect(html).toContain("تم تجهيز التقرير بنجاح (COMPLETED)");
    expect(html).toContain("الرابط غير متوفر");
    expect(html).toContain("disabled");
  });

  it("renders FAILED status banner with error message and retry button", () => {
    const html = renderToStaticMarkup(
      <RouterReportControl
        canExport={true}
        job={{
          status: "FAILED",
          error: "تجاوزت مهلة معالجة الملف على خادم Redis/BullMQ",
        }}
        onExport={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(html).toContain("فشل تجهيز التقرير (FAILED)");
    expect(html).toContain("تجاوزت مهلة معالجة الملف على خادم Redis/BullMQ");
    expect(html).toContain("إعادة المحاولة");
    expect(html).toContain("إغلاق");
  });
});
