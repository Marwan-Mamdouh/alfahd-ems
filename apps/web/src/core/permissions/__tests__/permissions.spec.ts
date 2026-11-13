import { describe, it, expect } from "vitest";
import { hasPermission } from "../permissions";
import { Role } from "@alfahd/types";

describe("Permissions Matrix - IP Address Management (Task B6)", () => {
  it("allows ADMIN and TECHNICIAN to view IP addresses", () => {
    expect(hasPermission(Role.ADMIN, "ips.view")).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, "ips.view")).toBe(true);
  });

  it("denies WAREHOUSE_STAFF and CS from viewing IP addresses", () => {
    expect(hasPermission(Role.WAREHOUSE_STAFF, "ips.view")).toBe(false);
    expect(hasPermission(Role.CS, "ips.view")).toBe(false);
  });

  it("strictly restricts ips.manage to ADMIN", () => {
    expect(hasPermission(Role.ADMIN, "ips.manage")).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, "ips.manage")).toBe(false);
    expect(hasPermission(Role.WAREHOUSE_STAFF, "ips.manage")).toBe(false);
    expect(hasPermission(Role.CS, "ips.manage")).toBe(false);
  });

  it("returns false if role is undefined", () => {
    expect(hasPermission(undefined, "ips.view")).toBe(false);
    expect(hasPermission(undefined, "ips.manage")).toBe(false);
  });
});
