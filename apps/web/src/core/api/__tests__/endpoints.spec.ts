import { describe, it, expect } from "vitest";
import { ENDPOINTS } from "../endpoints";

describe("ENDPOINTS Registry", () => {
  it("defines exact auth endpoints", () => {
    expect(ENDPOINTS.auth.login).toBe("/auth/login");
    expect(ENDPOINTS.auth.logout).toBe("/auth/logout");
    expect(ENDPOINTS.auth.refresh).toBe("/auth/refresh");
    expect(ENDPOINTS.auth.forgotPassword).toBe("/auth/forgot-password");
    expect(ENDPOINTS.auth.resetPassword).toBe("/auth/reset-password");
  });

  it("defines exact users and employees endpoints", () => {
    expect(ENDPOINTS.users.list).toBe("/users");
    expect(ENDPOINTS.users.detail("usr-1")).toBe("/users/usr-1");
    expect(ENDPOINTS.employees.list).toBe("/employees");
    expect(ENDPOINTS.employees.detail("123")).toBe("/employees/123");
    expect(ENDPOINTS.employees.byId("123")).toBe("/employees/123");
    expect(ENDPOINTS.employees.status("123")).toBe("/employees/123/status");
    expect(ENDPOINTS.employees.photo("123")).toBe("/employees/123/photo");
    // Ensure fabricated endpoints do not exist
    expect((ENDPOINTS.employees as Record<string, unknown>).deactivate).toBeUndefined();
  });

  it("defines exact attendance endpoints matching canonical routes", () => {
    expect(ENDPOINTS.attendance.checkIn).toBe("/attendance/check-in");
    expect(ENDPOINTS.attendance.checkOut).toBe("/attendance/check-out");
    expect(ENDPOINTS.attendance.override("rec-456")).toBe("/attendance/rec-456");
    expect(ENDPOINTS.attendance.record("rec-456")).toBe("/attendance/rec-456");
    expect(ENDPOINTS.attendance.byId("rec-456")).toBe("/attendance/rec-456");
    expect(ENDPOINTS.attendance.detail("rec-456")).toBe("/attendance/rec-456");
    expect(ENDPOINTS.attendance.report).toBe("/attendance/report");

    // Ensure fabricated endpoints do not exist
    expect((ENDPOINTS.attendance as Record<string, unknown>).today).toBeUndefined();
    expect((ENDPOINTS.attendance as Record<string, unknown>).list).toBeUndefined();
    expect((ENDPOINTS.attendance as Record<string, unknown>).records).toBeUndefined();
    expect((ENDPOINTS.attendance as Record<string, unknown>).byEmployee).toBeUndefined();
    expect((ENDPOINTS.attendance as Record<string, unknown>).summary).toBeUndefined();
  });

  it("defines exact warehouses endpoints matching canonical routes", () => {
    expect(ENDPOINTS.warehouses.list).toBe("/warehouses");
    expect(ENDPOINTS.warehouses.create).toBe("/warehouses");
    expect(ENDPOINTS.warehouses.detail("wh-1")).toBe("/warehouses/wh-1");
    expect(ENDPOINTS.warehouses.byId("wh-1")).toBe("/warehouses/wh-1");
    // Ensure fabricated endpoints do not exist
    expect((ENDPOINTS.warehouses as Record<string, unknown>).staff).toBeUndefined();
  });

  it("defines exact products endpoints", () => {
    expect(ENDPOINTS.products.list).toBe("/products");
    expect(ENDPOINTS.products.create).toBe("/products");
    expect(ENDPOINTS.products.detail("prod-1")).toBe("/products/prod-1");
    expect(ENDPOINTS.products.byId("prod-1")).toBe("/products/prod-1");
  });

  it("defines exact inventory operations and balances", () => {
    expect(ENDPOINTS.inventory.balances).toBe("/inventory");
    expect(ENDPOINTS.inventory.stock).toBe("/inventory");
    expect(ENDPOINTS.inventory.warehouseStock("wh-2")).toBe("/inventory/warehouses/wh-2");
    expect(ENDPOINTS.inventory.movements).toBe("/inventory/movements");
    expect(ENDPOINTS.inventory.inbound).toBe("/inventory/inbound");
    expect(ENDPOINTS.inventory.outbound).toBe("/inventory/outbound");
    expect(ENDPOINTS.inventory.returns).toBe("/inventory/returns");
    expect(ENDPOINTS.inventory.transfer).toBe("/inventory/transfer");
    expect(ENDPOINTS.inventory.adjust).toBe("/inventory/adjust");
  });

  it("defines exact routers endpoints", () => {
    expect(ENDPOINTS.routers.list).toBe("/routers");
    expect(ENDPOINTS.routers.create).toBe("/routers");
    expect(ENDPOINTS.routers.detail("r-1")).toBe("/routers/r-1");
    expect(ENDPOINTS.routers.byId("r-1")).toBe("/routers/r-1");
    expect(ENDPOINTS.routers.assign("r-1")).toBe("/routers/r-1/assign");
    expect(ENDPOINTS.routers.transition("r-1")).toBe("/routers/r-1/transition");
    expect(ENDPOINTS.routers.condition("r-1")).toBe("/routers/r-1/condition");
    expect(ENDPOINTS.routers.assignments("r-1")).toBe("/routers/r-1/assignments");
    expect(ENDPOINTS.routers.conditionHistory("r-1")).toBe("/routers/r-1/condition-history");
    expect(ENDPOINTS.routers.statusHistory("r-1")).toBe("/routers/r-1/status-history");
  });

  it("defines exact ip-addresses endpoints with hyphenated root", () => {
    expect(ENDPOINTS.ipAddresses.list).toBe("/ip-addresses");
    expect(ENDPOINTS.ipAddresses.create).toBe("/ip-addresses");
    expect(ENDPOINTS.ipAddresses.import).toBe("/ip-addresses/import");
    expect(ENDPOINTS.ipAddresses.detail("ip-1")).toBe("/ip-addresses/ip-1");
    expect(ENDPOINTS.ipAddresses.byId("ip-1")).toBe("/ip-addresses/ip-1");
    expect(ENDPOINTS.ipAddresses.reserve("ip-1")).toBe("/ip-addresses/ip-1/reserve");
    expect(ENDPOINTS.ipAddresses.release("ip-1")).toBe("/ip-addresses/ip-1/release");
    expect(ENDPOINTS.ipAddresses.archive("ip-1")).toBe("/ip-addresses/ip-1/archive");
    expect(ENDPOINTS.ipAddresses.unarchive("ip-1")).toBe("/ip-addresses/ip-1/unarchive");
    expect(ENDPOINTS.ipAddresses.history("ip-1")).toBe("/ip-addresses/ip-1/history");
  });

  it("defines exact jobs endpoints", () => {
    expect(ENDPOINTS.jobs.status("job-123")).toBe("/jobs/job-123");
    expect(ENDPOINTS.jobs.download("job-123")).toBe("/jobs/job-123/download");
  });
});
