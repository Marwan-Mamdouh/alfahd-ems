import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceExportDialog } from "../attendance-export-dialog";
import type { Job } from "../types";

describe("AttendanceExportDialog (Export Report Lifecycle)", () => {
  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={false}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders report parameters form when job is idle", () => {
    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={{ kind: "idle" }}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("تصدير تقرير الحضور والانصراف");
    expect(html).toContain("من تاريخ");
    expect(html).toContain("إلى تاريخ");
    expect(html).toContain("القسم (اختياري)");
    expect(html).toContain("طلب التقرير");
    expect(html).toContain('data-testid="export-submit-btn"');
  });

  it("renders polling/processing state when job is polling in queue", () => {
    const pollingJob: Job = {
      kind: "polling",
      job: {
        id: "job-123",
        status: "QUEUED",
      },
    };

    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={pollingJob}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("الطلب في قائمة الانتظار بالخلفية...");
    expect(html).toContain('data-testid="export-polling-state"');
  });

  it("renders running state when job is processing", () => {
    const runningJob: Job = {
      kind: "polling",
      job: {
        id: "job-123",
        status: "RUNNING",
      },
    };

    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={runningJob}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("جارٍ تجميع وتوليد بيانات التقرير...");
  });

  it("renders download button ONLY when job is complete and downloadUrl is present", () => {
    const completeJobWithUrl: Job = {
      kind: "complete",
      job: {
        id: "job-123",
        status: "COMPLETED",
        downloadUrl: "https://example.com/reports/attendance.xlsx",
      },
    };

    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={completeJobWithUrl}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("تم إنشاء التقرير بنجاح!");
    expect(html).toContain("تحميل التقرير (.xlsx)");
    expect(html).toContain('data-testid="export-download-btn"');
  });

  it("does NOT render a download button when job is complete without a downloadUrl", () => {
    const completeJobNoUrl: Job = {
      kind: "complete",
      job: {
        id: "job-123",
        status: "COMPLETED",
        downloadUrl: null,
      },
    };

    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={completeJobNoUrl}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("تم إنشاء التقرير بنجاح!");
    expect(html).not.toContain('data-testid="export-download-btn"');
    expect(html).toContain("التقرير اكتمل ولكن لم يُرفق رابط تنزيل مباشر من الخادم.");
  });

  it("renders error state with retry option when job encounters an error", () => {
    const errorJob: Job = {
      kind: "error",
      message: "فترة التقرير تتجاوز الحد الأقصى المسموح به (366 يوماً).",
    };

    const html = renderToStaticMarkup(
      <AttendanceExportDialog
        isOpen={true}
        job={errorJob}
        onClose={vi.fn()}
        onRequestExport={vi.fn()}
      />
    );

    expect(html).toContain("فشل إنشاء التقرير");
    expect(html).toContain("فترة التقرير تتجاوز الحد الأقصى المسموح به (366 يوماً).");
    expect(html).toContain("المحاولة مجدداً");
    expect(html).toContain('data-testid="export-retry-btn"');
  });
});
