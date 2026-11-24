import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getIpCapabilities,
  getWarehouseCapabilities,
  getProductCapabilities,
  getInventoryCapabilities,
  getRouterCapabilities,
  getAttendanceCapabilities,
  getEmployeeCapabilities,
} from "../permissions";
import { Role } from "@alfahd/types";

describe("Permissions Matrix & Action Capabilities (Issue #88 / Phase 2 F7)", () => {
  describe("IPv4 Address Management Permissions (A2 / B6)", () => {
    it("allows ADMIN and TECHNICIAN to view IP addresses", () => {
      expect(hasPermission(Role.ADMIN, "ips.view")).toBe(true);
      expect(hasPermission(Role.TECHNICIAN, "ips.view")).toBe(true);
    });

    it("strictly denies WAREHOUSE_STAFF and CS from viewing IP addresses", () => {
      expect(hasPermission(Role.WAREHOUSE_STAFF, "ips.view")).toBe(false);
      expect(hasPermission(Role.CS, "ips.view")).toBe(false);
    });

    it("strictly restricts ips.manage, ips.import, and ips.history to ADMIN", () => {
      expect(hasPermission(Role.ADMIN, "ips.manage")).toBe(true);
      expect(hasPermission(Role.ADMIN, "ips.import")).toBe(true);
      expect(hasPermission(Role.ADMIN, "ips.history")).toBe(true);

      // Denied for technician
      expect(hasPermission(Role.TECHNICIAN, "ips.manage")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "ips.import")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "ips.history")).toBe(false);

      // Denied for warehouse staff and CS
      expect(hasPermission(Role.WAREHOUSE_STAFF, "ips.manage")).toBe(false);
      expect(hasPermission(Role.CS, "ips.manage")).toBe(false);
    });

    it("generates correct IpCapabilities for TECHNICIAN (Read-Only)", () => {
      const caps = getIpCapabilities(Role.TECHNICIAN);
      expect(caps.canView).toBe(true);
      expect(caps.canManage).toBe(false);
      expect(caps.canImport).toBe(false);
      expect(caps.isReadOnly).toBe(true);
      expect(caps.isDenied).toBe(false);
    });

    it("generates correct IpCapabilities for WAREHOUSE_STAFF and CS (Denied)", () => {
      const warehouseCaps = getIpCapabilities(Role.WAREHOUSE_STAFF);
      expect(warehouseCaps.canView).toBe(false);
      expect(warehouseCaps.canManage).toBe(false);
      expect(warehouseCaps.isReadOnly).toBe(false);
      expect(warehouseCaps.isDenied).toBe(true);

      const csCaps = getIpCapabilities(Role.CS);
      expect(csCaps.canView).toBe(false);
      expect(csCaps.isDenied).toBe(true);
    });

    it("generates correct IpCapabilities for ADMIN (Full Access)", () => {
      const caps = getIpCapabilities(Role.ADMIN);
      expect(caps.canView).toBe(true);
      expect(caps.canManage).toBe(true);
      expect(caps.canImport).toBe(true);
      expect(caps.isReadOnly).toBe(false);
      expect(caps.isDenied).toBe(false);
    });
  });

  describe("Warehouse Permissions & Capabilities (A2 / B2)", () => {
    it("allows ADMIN, WAREHOUSE_STAFF, and CS to view warehouses", () => {
      expect(hasPermission(Role.ADMIN, "warehouses.view")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "warehouses.view")).toBe(true);
      expect(hasPermission(Role.CS, "warehouses.view")).toBe(true);
      expect(hasPermission(Role.TECHNICIAN, "warehouses.view")).toBe(false);
    });

    it("strictly restricts warehouse management, creation, update, and deactivation to ADMIN (Least Privilege)", () => {
      expect(hasPermission(Role.ADMIN, "warehouses.manage")).toBe(true);
      expect(hasPermission(Role.ADMIN, "warehouses.create")).toBe(true);
      expect(hasPermission(Role.ADMIN, "warehouses.update")).toBe(true);
      expect(hasPermission(Role.ADMIN, "warehouses.deactivate")).toBe(true);

      // WAREHOUSE_STAFF can only read, cannot mutate warehouses
      expect(hasPermission(Role.WAREHOUSE_STAFF, "warehouses.manage")).toBe(false);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "warehouses.create")).toBe(false);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "warehouses.update")).toBe(false);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "warehouses.deactivate")).toBe(false);

      // CS and TECHNICIAN cannot mutate warehouses
      expect(hasPermission(Role.CS, "warehouses.manage")).toBe(false);
      expect(hasPermission(Role.CS, "warehouses.create")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "warehouses.manage")).toBe(false);
    });

    it("evaluates WarehouseCapabilities correctly per role", () => {
      const adminCaps = getWarehouseCapabilities(Role.ADMIN);
      expect(adminCaps.canView).toBe(true);
      expect(adminCaps.canManage).toBe(true);
      expect(adminCaps.canCreate).toBe(true);
      expect(adminCaps.canUpdate).toBe(true);
      expect(adminCaps.canDeactivate).toBe(true);

      const staffCaps = getWarehouseCapabilities(Role.WAREHOUSE_STAFF);
      expect(staffCaps.canView).toBe(true);
      expect(staffCaps.canManage).toBe(false);
      expect(staffCaps.canCreate).toBe(false);
      expect(staffCaps.canUpdate).toBe(false);
      expect(staffCaps.canDeactivate).toBe(false);

      const csCaps = getWarehouseCapabilities(Role.CS);
      expect(csCaps.canView).toBe(true);
      expect(csCaps.canManage).toBe(false);
      expect(csCaps.canCreate).toBe(false);
      expect(csCaps.canUpdate).toBe(false);
      expect(csCaps.canDeactivate).toBe(false);

      const techCaps = getWarehouseCapabilities(Role.TECHNICIAN);
      expect(techCaps.canView).toBe(false);
      expect(techCaps.canManage).toBe(false);
    });
  });

  describe("Product & Inventory Permissions & Capabilities (A2 / B3)", () => {
    it("allows all four roles to view products", () => {
      expect(hasPermission(Role.ADMIN, "products.view")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "products.view")).toBe(true);
      expect(hasPermission(Role.CS, "products.view")).toBe(true);
      expect(hasPermission(Role.TECHNICIAN, "products.view")).toBe(true);
    });

    it("allows ADMIN and WAREHOUSE_STAFF to create and update products, but only ADMIN to deactivate", () => {
      expect(hasPermission(Role.ADMIN, "products.create")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "products.create")).toBe(true);
      expect(hasPermission(Role.CS, "products.create")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "products.create")).toBe(false);

      expect(hasPermission(Role.ADMIN, "products.deactivate")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "products.deactivate")).toBe(false);
    });

    it("allows ADMIN and WAREHOUSE_STAFF to record inventory movements, but only ADMIN to adjust stock", () => {
      expect(hasPermission(Role.ADMIN, "inventory.movement")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "inventory.movement")).toBe(true);
      expect(hasPermission(Role.CS, "inventory.movement")).toBe(false);

      expect(hasPermission(Role.ADMIN, "inventory.adjust")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "inventory.adjust")).toBe(false);
    });

    it("evaluates ProductCapabilities and InventoryCapabilities correctly", () => {
      const prodStaff = getProductCapabilities(Role.WAREHOUSE_STAFF);
      expect(prodStaff.canView).toBe(true);
      expect(prodStaff.canCreate).toBe(true);
      expect(prodStaff.canDeactivate).toBe(false);

      const invStaff = getInventoryCapabilities(Role.WAREHOUSE_STAFF);
      expect(invStaff.canViewStock).toBe(true);
      expect(invStaff.canRecordMovement).toBe(true);
      expect(invStaff.canAdjustStock).toBe(false);

      const invAdmin = getInventoryCapabilities(Role.ADMIN);
      expect(invAdmin.canAdjustStock).toBe(true);
    });
  });

  describe("Router Asset Permissions & Capabilities (A2 / B4)", () => {
    it("allows all four roles to view routers", () => {
      expect(hasPermission(Role.ADMIN, "routers.view")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "routers.view")).toBe(true);
      expect(hasPermission(Role.CS, "routers.view")).toBe(true);
      expect(hasPermission(Role.TECHNICIAN, "routers.view")).toBe(true);
    });

    it("allows ADMIN and WAREHOUSE_STAFF to assign, transition, and update condition", () => {
      expect(hasPermission(Role.ADMIN, "routers.assign")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "routers.assign")).toBe(true);
      expect(hasPermission(Role.CS, "routers.assign")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "routers.assign")).toBe(false);
    });

    it("strictly restricts router report export to ADMIN", () => {
      expect(hasPermission(Role.ADMIN, "routers.export")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "routers.export")).toBe(false);
      expect(hasPermission(Role.CS, "routers.export")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "routers.export")).toBe(false);
    });

    it("evaluates RouterCapabilities correctly per role", () => {
      const staffCaps = getRouterCapabilities(Role.WAREHOUSE_STAFF);
      expect(staffCaps.canView).toBe(true);
      expect(staffCaps.canManage).toBe(true);
      expect(staffCaps.canAssign).toBe(true);
      expect(staffCaps.canTransition).toBe(true);
      expect(staffCaps.canExport).toBe(false);

      const techCaps = getRouterCapabilities(Role.TECHNICIAN);
      expect(techCaps.canView).toBe(true);
      expect(techCaps.canManage).toBe(false);
      expect(techCaps.canAssign).toBe(false);
    });
  });

  describe("Attendance & Employee Permissions & Capabilities (A2 / B1)", () => {
    it("restricts attendance overview and reports to ADMIN", () => {
      expect(hasPermission(Role.ADMIN, "attendance.view")).toBe(true);
      expect(hasPermission(Role.ADMIN, "attendance.override")).toBe(true);
      expect(hasPermission(Role.ADMIN, "attendance.report")).toBe(true);

      expect(hasPermission(Role.TECHNICIAN, "attendance.view")).toBe(false);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "attendance.view")).toBe(false);
      expect(hasPermission(Role.CS, "attendance.view")).toBe(false);
    });

    it("permits attendance checkin specifically for TECHNICIAN", () => {
      expect(hasPermission(Role.TECHNICIAN, "attendance.checkin")).toBe(true);
      expect(hasPermission(Role.ADMIN, "attendance.checkin")).toBe(false);
    });

    it("permits employee lookup for ADMIN and WAREHOUSE_STAFF", () => {
      expect(hasPermission(Role.ADMIN, "employees.lookup")).toBe(true);
      expect(hasPermission(Role.WAREHOUSE_STAFF, "employees.lookup")).toBe(true);
      expect(hasPermission(Role.CS, "employees.lookup")).toBe(false);
      expect(hasPermission(Role.TECHNICIAN, "employees.lookup")).toBe(false);
    });

    it("evaluates AttendanceCapabilities and EmployeeCapabilities correctly", () => {
      const techAtt = getAttendanceCapabilities(Role.TECHNICIAN);
      expect(techAtt.canCheckInOut).toBe(true);
      expect(techAtt.canView).toBe(false);
      expect(techAtt.canOverride).toBe(false);

      const adminEmp = getEmployeeCapabilities(Role.ADMIN);
      expect(adminEmp.canView).toBe(true);
      expect(adminEmp.canManage).toBe(true);
      expect(adminEmp.canLookup).toBe(true);
      expect(adminEmp.canChangeStatus).toBe(true);
      expect(adminEmp.canUploadPhoto).toBe(true);

      const staffEmp = getEmployeeCapabilities(Role.WAREHOUSE_STAFF);
      expect(staffEmp.canLookup).toBe(true);
      expect(staffEmp.canManage).toBe(false);
      expect(staffEmp.canChangeStatus).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("returns false and denied flags if role is undefined", () => {
      expect(hasPermission(undefined, "ips.view")).toBe(false);
      expect(hasPermission(undefined, "warehouses.view")).toBe(false);

      const caps = getIpCapabilities(undefined);
      expect(caps.canView).toBe(false);
      expect(caps.isDenied).toBe(true);
    });
  });
});
