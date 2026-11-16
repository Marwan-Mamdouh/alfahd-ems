import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  IPV4_REGEX,
  MAX_FILE_SIZE_BYTES,
  MAX_ROWS_LIMIT,
  getAvailableRowActions,
  validateCsvFile,
  validateIpActionEligibility,
  validateIpv4Address,
} from "./validation";
import type { IpCapabilities, JobStatusResponseDto } from "./types";

describe("Issue #87 (F6) — IPv4 Management & CSV Import Component Logic", () => {
  // ─── 1. Statuses & State Transitions ───────────────────────────────────────
  describe("1. Operational Statuses & State Transitions", () => {
    test("FREE IP allows reserve, forbids release, allows archive", () => {
      const freeIp = { status: "FREE" as const, isArchived: false };

      const reserveCheck = validateIpActionEligibility("reserve", freeIp);
      assert.equal(reserveCheck.allowed, true);

      const releaseCheck = validateIpActionEligibility("release", freeIp);
      assert.equal(releaseCheck.allowed, false);
      assert.match(releaseCheck.reason ?? "", /متاح بالفعل/);

      const archiveCheck = validateIpActionEligibility("archive", freeIp);
      assert.equal(archiveCheck.allowed, true);

      const unarchiveCheck = validateIpActionEligibility("unarchive", freeIp);
      assert.equal(unarchiveCheck.allowed, false);
      assert.match(unarchiveCheck.reason ?? "", /غير مؤرشف/);
    });

    test("RESERVED IP allows release, forbids reserve, and forbids archive", () => {
      const reservedIp = { status: "RESERVED" as const, isArchived: false };

      const releaseCheck = validateIpActionEligibility("release", reservedIp);
      assert.equal(releaseCheck.allowed, true);

      const reserveCheck = validateIpActionEligibility("reserve", reservedIp);
      assert.equal(reserveCheck.allowed, false);
      assert.match(reserveCheck.reason ?? "", /محجوز بالفعل/);
    });

    test("ARCHIVED IP forbids reserve and release; allows unarchive", () => {
      const archivedIp = { status: "FREE" as const, isArchived: true };

      const reserveCheck = validateIpActionEligibility("reserve", archivedIp);
      assert.equal(reserveCheck.allowed, false);
      assert.match(reserveCheck.reason ?? "", /لا يمكن حجز عنوان مؤرشف/);

      const releaseCheck = validateIpActionEligibility("release", archivedIp);
      assert.equal(releaseCheck.allowed, false);
      assert.match(releaseCheck.reason ?? "", /لا يمكن تحرير عنوان مؤرشف/);

      const archiveCheck = validateIpActionEligibility("archive", archivedIp);
      assert.equal(archiveCheck.allowed, false);
      assert.match(archiveCheck.reason ?? "", /مؤرشف بالفعل/);

      const unarchiveCheck = validateIpActionEligibility("unarchive", archivedIp);
      assert.equal(unarchiveCheck.allowed, true);
    });
  });

  // ─── 2. Archival Conflicts ─────────────────────────────────────────────────
  describe("2. Archival Conflicts & Constraints", () => {
    test("Archiving a RESERVED IP is strictly rejected with conflict explanation", () => {
      const reservedIp = { status: "RESERVED" as const, isArchived: false };
      const result = validateIpActionEligibility("archive", reservedIp);

      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes("تعارض في الأرشفة"));
      assert.ok(result.reason?.includes("لا يمكن أرشفة عنوان محجوز (RESERVED)"));
    });

    test("Archived IP cannot be archived again", () => {
      const archivedReserved = { status: "RESERVED" as const, isArchived: true };
      const result = validateIpActionEligibility("archive", archivedReserved);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /مؤرشف بالفعل/);
    });
  });

  // ─── 3. Capability-based Action Rendering ──────────────────────────────────
  describe("3. Permission & Capability Matrix", () => {
    const fullCapabilities: IpCapabilities = {
      read: true,
      create: true,
      edit: true,
      reserve: true,
      archive: true,
      history: true,
      import: true,
    };

    test("Full capabilities enable actions matching IP domain status", () => {
      const freeActions = getAvailableRowActions(
        { status: "FREE", isArchived: false },
        fullCapabilities
      );
      assert.equal(freeActions.canEdit, true);
      assert.equal(freeActions.canReserve, true);
      assert.equal(freeActions.canRelease, false);
      assert.equal(freeActions.canArchive, true);
      assert.equal(freeActions.canUnarchive, false);
      assert.equal(freeActions.canViewHistory, true);

      const reservedActions = getAvailableRowActions(
        { status: "RESERVED", isArchived: false },
        fullCapabilities
      );
      assert.equal(reservedActions.canEdit, true);
      assert.equal(reservedActions.canReserve, false);
      assert.equal(reservedActions.canRelease, true);
      assert.equal(reservedActions.canArchive, false); // Blocked: archival conflict
      assert.equal(reservedActions.canUnarchive, false);
      assert.equal(reservedActions.canViewHistory, true);

      const archivedActions = getAvailableRowActions(
        { status: "FREE", isArchived: true },
        fullCapabilities
      );
      assert.equal(archivedActions.canEdit, true);
      assert.equal(archivedActions.canReserve, false);
      assert.equal(archivedActions.canRelease, false);
      assert.equal(archivedActions.canArchive, false);
      assert.equal(archivedActions.canUnarchive, true);
      assert.equal(archivedActions.canViewHistory, true);
    });

    test("Missing capabilities disable corresponding actions regardless of status", () => {
      const readOnlyCapabilities: IpCapabilities = {
        read: true,
        create: false,
        edit: false,
        reserve: false,
        archive: false,
        history: false,
        import: false,
      };

      const actions = getAvailableRowActions(
        { status: "FREE", isArchived: false },
        readOnlyCapabilities
      );
      assert.equal(actions.canEdit, false);
      assert.equal(actions.canReserve, false);
      assert.equal(actions.canRelease, false);
      assert.equal(actions.canArchive, false);
      assert.equal(actions.canUnarchive, false);
      assert.equal(actions.canViewHistory, false);
    });
  });

  // ─── 4. IPv4 Host Constraints & Regex Validation ───────────────────────────
  describe("4. IPv4 Host Constraints & Validation", () => {
    test("Accepts valid IPv4 host addresses", () => {
      assert.equal(IPV4_REGEX.test("192.168.1.1"), true);
      assert.equal(validateIpv4Address("192.168.1.1"), null);
      assert.equal(validateIpv4Address("10.0.0.1"), null);
      assert.equal(validateIpv4Address("172.16.254.1"), null);
      assert.equal(validateIpv4Address("255.255.255.255"), null);
      assert.equal(validateIpv4Address("0.0.0.0"), null);
      assert.equal(validateIpv4Address("  192.168.1.50  "), null); // Trims whitespace
    });

    test("Rejects CIDR masks and range notation", () => {
      const result = validateIpv4Address("192.168.1.0/24");
      assert.ok(result?.includes("CIDR"));

      const result16 = validateIpv4Address("10.0.0.0/16");
      assert.ok(result16?.includes("CIDR"));
    });

    test("Rejects IPv6 addresses", () => {
      const result = validateIpv4Address("::1");
      assert.ok(result?.includes("IPv6"));

      const resultGlobal = validateIpv4Address("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      assert.ok(resultGlobal?.includes("IPv6"));
    });

    test("Rejects out-of-range octets and invalid formats", () => {
      assert.notEqual(validateIpv4Address("256.0.0.1"), null);
      assert.notEqual(validateIpv4Address("192.168.1.999"), null);
      assert.notEqual(validateIpv4Address("192.168.1"), null);
      assert.notEqual(validateIpv4Address("192.168.1.1.1"), null);
      assert.notEqual(validateIpv4Address("abc.def.ghi.jkl"), null);
    });

    test("Rejects empty or whitespace-only strings", () => {
      assert.notEqual(validateIpv4Address(""), null);
      assert.notEqual(validateIpv4Address("   "), null);
    });
  });

  // ─── 5. CSV File Constraints ───────────────────────────────────────────────
  describe("5. CSV File Constraints", () => {
    test("MAX_FILE_SIZE_BYTES is exactly 5 MiB", () => {
      assert.equal(MAX_FILE_SIZE_BYTES, 5 * 1024 * 1024);
      assert.equal(MAX_ROWS_LIMIT, 5000);
    });

    test("Accepts valid .csv files under 5 MiB", () => {
      const validFile = { name: "ip_pool_batch_1.csv", size: 1024 * 1024 }; // 1 MiB
      assert.equal(validateCsvFile(validFile), null);

      const uppercaseCsv = { name: "ADDRESSES.CSV", size: 500 };
      assert.equal(validateCsvFile(uppercaseCsv), null);
    });

    test("Rejects files exceeding 5 MiB limit", () => {
      const oversizedFile = {
        name: "huge_list.csv",
        size: MAX_FILE_SIZE_BYTES + 1,
      };
      const result = validateCsvFile(oversizedFile);
      assert.ok(result?.includes("يتجاوز الحد الأقصى"));
    });

    test("Rejects non-CSV extensions", () => {
      const xlsxFile = { name: "data.xlsx", size: 1000 };
      assert.ok(validateCsvFile(xlsxFile)?.includes("صيغة CSV"));

      const txtFile = { name: "data.txt", size: 1000 };
      assert.ok(validateCsvFile(txtFile)?.includes("صيغة CSV"));

      const exeFile = { name: "data.csv.exe", size: 1000 };
      assert.ok(validateCsvFile(exeFile)?.includes("صيغة CSV"));
    });
  });

  // ─── 6. BullMQ Job Status & Error Result Structure ─────────────────────────
  describe("6. Job Status & Result Data Contract", () => {
    test("Correctly structures completed job with success and error metrics", () => {
      const completedJob: JobStatusResponseDto = {
        id: "job-import-12345",
        status: "COMPLETED",
        inserted: 147,
        skipped: 3,
        errors: [
          { row: 12, address: "192.168.1.256", reason: "عنوان IP غير صالح" },
          { row: 45, address: "10.0.0.1", reason: "العنوان موجود بالفعل في النظام" },
          { row: 89, address: "172.16.0.0/24", reason: "تنسيق CIDR غير مسموح" },
        ],
        result: {
          total: 150,
          inserted: 147,
          skipped: 3,
          errors: [
            { row: 12, address: "192.168.1.256", reason: "عنوان IP غير صالح" },
            { row: 45, address: "10.0.0.1", reason: "العنوان موجود بالفعل في النظام" },
            { row: 89, address: "172.16.0.0/24", reason: "تنسيق CIDR غير مسموح" },
          ],
        },
      };

      assert.equal(completedJob.status, "COMPLETED");
      assert.equal(
        (completedJob.result?.inserted ?? 0) + (completedJob.result?.skipped ?? 0),
        completedJob.result?.total
      );
      assert.equal(completedJob.result?.errors?.length, 3);
      assert.equal(completedJob.result?.errors?.[0]?.row, 12);
    });

    test("Correctly structures failed job state", () => {
      const failedJob: JobStatusResponseDto = {
        id: "job-import-99999",
        status: "FAILED",
        error: "الملف تالف أو غير صالح للتحليل",
      };

      assert.equal(failedJob.status, "FAILED");
      assert.ok(failedJob.error?.includes("تالف"));
    });
  });
});
