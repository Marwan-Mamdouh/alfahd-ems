import { describe, it, expect } from "vitest";
import {
  validateCsvFile,
  parseCsvHeader,
  formatFileSize,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
} from "../csv-validator";

describe("CSV Validator Utilities", () => {
  describe("formatFileSize", () => {
    it("formats bytes, kilobytes, and megabytes correctly", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(2048)).toBe("2.0 KB");
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
    });
  });

  describe("parseCsvHeader", () => {
    it("parses and trims simple comma-separated headers", () => {
      const headers = parseCsvHeader("address, notes, label");
      expect(headers).toEqual(["address", "notes", "label"]);
    });

    it("handles quotes and embedded spaces in header tokens", () => {
      const headers = parseCsvHeader('"IP Address", "Target Notes", status');
      expect(headers).toEqual(["IP Address", "Target Notes", "status"]);
    });

    it("strips UTF-8 BOM (\\uFEFF) from the start of the header", () => {
      const headers = parseCsvHeader("\uFEFFaddress,notes");
      expect(headers).toEqual(["address", "notes"]);
    });
  });

  describe("validateCsvFile", () => {
    it("approves valid CSV file with required headers and data rows", async () => {
      const validContent = "address,notes\n192.168.1.1,Router Gateway\n192.168.1.2,Access Point";
      const file = new File([validContent], "network-ips.csv", { type: "text/csv" });

      const result = await validateCsvFile(file, { requiredHeaders: ["address"] });

      expect(result.isValid).toBe(true);
      expect(result.headers).toEqual(["address", "notes"]);
      expect(result.estimatedRowCount).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it("supports and strips UTF-8 BOM from files exported by Excel", async () => {
      const bomContent = "\uFEFFaddress,notes\n10.0.0.1,Server A";
      const file = new File([bomContent], "excel-export.csv", { type: "text/csv" });

      const result = await validateCsvFile(file, { requiredHeaders: ["address"] });

      expect(result.isValid).toBe(true);
      expect(result.headers).toEqual(["address", "notes"]);
    });

    it("rejects CSV file exceeding 5,000 nonblank rows", async () => {
      const rows = ["address,notes"];
      for (let i = 0; i <= MAX_CSV_ROWS; i++) {
        rows.push(`192.168.1.${i % 250},Row ${i}`);
      }
      const largeContent = rows.join("\n");
      const file = new File([largeContent], "too-many-rows.csv", { type: "text/csv" });

      const result = await validateCsvFile(file, { maxRows: MAX_CSV_ROWS });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeding the maximum allowed limit of 5,000 nonblank rows");
    });

    it("rejects rows with unclosed quotes communicating parser limitation", async () => {
      const malformedContent = 'address,notes\n192.168.1.1,"unclosed quote notes\n192.168.1.2,Valid';
      const file = new File([malformedContent], "malformed.csv", { type: "text/csv" });

      const result = await validateCsvFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("unclosed quotes");
    });

    it("rejects non-csv file extensions", async () => {
      const file = new File(["some data"], "inventory.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await validateCsvFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Only CSV files are supported");
    });

    it("rejects file exceeding size limit", async () => {
      const file = new File(["dummy content"], "large-import.csv", { type: "text/csv" });
      Object.defineProperty(file, "size", { value: MAX_CSV_FILE_SIZE + 1024 });

      const result = await validateCsvFile(file, { maxSizeBytes: MAX_CSV_FILE_SIZE });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeds the maximum allowed limit");
    });

    it("rejects empty CSV file", async () => {
      const file = new File([""], "empty.csv", { type: "text/csv" });

      const result = await validateCsvFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("rejects CSV file with header but 0 data rows", async () => {
      const file = new File(["address,notes"], "no-rows.csv", { type: "text/csv" });

      const result = await validateCsvFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("contains a header but no data rows");
    });

    it("rejects CSV missing required columns", async () => {
      const file = new File(["hostname,location\nhost1,Cairo", "ips.csv"], "ips.csv", {
        type: "text/csv",
      });

      const result = await validateCsvFile(file, { requiredHeaders: ["address"] });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Missing required column(s): address");
    });
  });
});
