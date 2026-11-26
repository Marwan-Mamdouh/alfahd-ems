import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpImportDialog, IP_CSV_SAMPLE } from "../ip-import-dialog";
import {
  validateCsvFile,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
} from "@/components/shared/csv/csv-validator";

describe("IpImportDialog Component & CSV Import Constraints (Issue #87)", () => {
  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <IpImportDialog isOpen={false} onClose={vi.fn()} onImport={vi.fn()} />
    );
    expect(html).toBe("");
  });

  it("displays approved headers, 5 MiB / 5,000-row limits, valid sample CSV, and backend parser limitations", () => {
    const html = renderToStaticMarkup(
      <IpImportDialog isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />
    );

    expect(html).toContain("ip-csv-guidance");
    // Approved headers & limits
    expect(html).toContain("address");
    expect(html).toContain("notes");
    expect(html).toContain("5 MiB");
    expect(html).toContain("5,000");

    // Sample CSV from backend contract
    expect(html).toContain("ip-csv-sample");
    expect(html).toContain("192.0.2.1,Example address");
    expect(html).toContain("192.0.2.2,");
    expect(IP_CSV_SAMPLE).toContain("address,notes");

    // Parser limitations (UTF-8/BOM, comma delimiter, no quoted commas/newlines, physical line numbers)
    expect(html).toContain("UTF-8");
    expect(html).toContain("لا يدعم المحلل الحقول المقتبسة التي تحتوي على فواصل");
    expect(html).toContain("رقم السطر الفعلي في الملف الأصلي");
  });

  it("renders distinct submitting, QUEUED, and RUNNING job states", () => {
    const submittingHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        isSubmitting={true}
        jobStatus={null}
      />
    );
    expect(submittingHtml).toContain("ip-import-submitting");
    expect(submittingHtml).not.toContain("ip-import-queued");
    expect(submittingHtml).not.toContain("ip-import-running");

    const queuedHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="QUEUED"
      />
    );
    expect(queuedHtml).toContain("ip-import-queued");
    expect(queuedHtml).toContain("في قائمة الانتظار (QUEUED)");
    expect(queuedHtml).not.toContain("ip-import-running");
    expect(queuedHtml).not.toContain("ip-import-completed");
    expect(queuedHtml).toContain("disabled");

    const runningHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="RUNNING"
      />
    );
    expect(runningHtml).toContain("ip-import-running");
    expect(runningHtml).toContain("جاري التنفيذ والمعالجة (RUNNING)");
    expect(runningHtml).not.toContain("ip-import-queued");
    expect(runningHtml).not.toContain("ip-import-completed");
    expect(runningHtml).toContain("disabled");
  });

  it("treats FAILED as an error terminal state and never renders green success banner", () => {
    const failedHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="FAILED"
        errorMessage="Worker job failed"
      />
    );

    expect(failedHtml).toContain("ip-import-failed");
    expect(failedHtml).toContain("فشلت معالجة ملف الاستيراد (FAILED)");
    expect(failedHtml).toContain("Worker job failed");
    expect(failedHtml).not.toContain("ip-import-completed");
    expect(failedHtml).not.toContain("اكتملت معالجة ملف CSV بنجاح");
    expect(failedHtml).not.toContain("bg-emerald-500/10");
  });

  it("renders COMPLETED success with separated inserted, skipped, errors counts, explicit total, and physical CSV line numbers", () => {
    const completedHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="COMPLETED"
        result={{
          total: 20,
          inserted: 14,
          skipped: 4,
          errors: [
            {
              row: 4,
              address: "192.168.1.0/24",
              reason: "Invalid IPv4 host address format (no CIDR or IPv6 allowed)",
            },
            {
              row: 9,
              address: "",
              reason: "Empty address field",
            },
          ],
        }}
      />
    );

    expect(completedHtml).toContain("ip-import-completed");
    expect(completedHtml).toContain("اكتملت معالجة ملف CSV بنجاح (COMPLETED)");
    expect(completedHtml).toContain("ip-import-stat-inserted");
    expect(completedHtml).toContain("ip-import-stat-skipped");
    expect(completedHtml).toContain("ip-import-stat-errors");
    expect(completedHtml).toContain("14");
    expect(completedHtml).toContain("4");
    expect(completedHtml).toContain("2");
    expect(completedHtml).toContain("ip-import-total-count");
    expect(completedHtml).toContain("20");
    expect(completedHtml).toContain("ip-import-errors-table");
    expect(completedHtml).toContain("#4");
    expect(completedHtml).toContain("192.168.1.0/24");
    expect(completedHtml).toContain("#9");
    expect(completedHtml).toContain("Empty address field");
  });

  it("handles missing or partial result fields safely without inventing totalProcessed fallback", () => {
    const partialHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="COMPLETED"
        result={{ inserted: 5 }}
      />
    );

    expect(partialHtml).toContain("ip-import-completed");
    expect(partialHtml).toContain("5");
    expect(partialHtml).toContain("0");
    // Must not invent totalProcessed fallback when total is absent
    expect(partialHtml).not.toContain("ip-import-total-count");
    expect(partialHtml).not.toContain("totalProcessed");

    const nullResultHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        jobStatus="COMPLETED"
        result={null}
      />
    );
    expect(nullResultHtml).toContain("ip-import-completed");
    expect(nullResultHtml).not.toContain("ip-import-errors-table");
  });

  it("renders recoverable timeout state with retry button", () => {
    const timeoutHtml = renderToStaticMarkup(
      <IpImportDialog
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        isTimedOut={true}
        onRetryPolling={vi.fn()}
      />
    );

    expect(timeoutHtml).toContain("ip-import-timeout");
    expect(timeoutHtml).toContain("ip-import-retry-btn");
    expect(timeoutHtml).toContain("إعادة التحقق من الحالة");
  });

  it("enforces backend CSV file constraints (5 MiB, 5,000 rows, address header, no multiline quotes)", async () => {
    // Valid sample from contract
    const validFile = new File([IP_CSV_SAMPLE], "ips.csv", { type: "text/csv" });
    const validRes = await validateCsvFile(validFile, { requiredHeaders: ["address"] });
    expect(validRes.isValid).toBe(true);

    // > 5 MiB rejected
    const oversizedFile = new File(["address\n10.0.0.1"], "big.csv", { type: "text/csv" });
    Object.defineProperty(oversizedFile, "size", { value: MAX_CSV_FILE_SIZE + 1 });
    const sizeRes = await validateCsvFile(oversizedFile, { requiredHeaders: ["address"] });
    expect(sizeRes.isValid).toBe(false);

    // > 5,000 rows rejected
    const manyRows = ["address", ...Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `10.0.0.${i % 250}`)];
    const rowsFile = new File([manyRows.join("\n")], "many.csv", { type: "text/csv" });
    const rowsRes = await validateCsvFile(rowsFile, { requiredHeaders: ["address"] });
    expect(rowsRes.isValid).toBe(false);

    // Missing address header rejected
    const badHeaderFile = new File(["ip,notes\n10.0.0.1,test"], "bad-header.csv", {
      type: "text/csv",
    });
    const headerRes = await validateCsvFile(badHeaderFile, { requiredHeaders: ["address"] });
    expect(headerRes.isValid).toBe(false);
  });
});
