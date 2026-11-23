import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarContent } from "../sidebar-content";
import { Role } from "@alfahd/types";

let currentRole: Role | undefined = Role.ADMIN;
let currentPathname = "/dashboard";

vi.mock("@/core/auth/auth.store", () => ({
  useAuthStore: (selector: (state: { user?: { role: Role } }) => unknown) =>
    selector({ user: currentRole ? { role: currentRole } : undefined }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

describe("Sidebar Navigation Component (Issue #88 / F7)", () => {
  beforeEach(() => {
    currentRole = Role.ADMIN;
    currentPathname = "/dashboard";
  });

  describe("ADMIN Role Navigation", () => {
    it("renders full administrative navigation suite including all approved sections", () => {
      currentRole = Role.ADMIN;
      const html = renderToStaticMarkup(<SidebarContent />);

      // Live routes
      expect(html).toContain("لوحة التحكم");
      expect(html).toContain("الموظفون");

      // Gated Phase 2 routes (marked comingSoon)
      expect(html).toContain("المخازن");
      expect(html).toContain("المخزون");
      expect(html).toContain("الراوترات");
      expect(html).toContain("عناوين IP");
      expect(html).toContain("الحضور");

      // Accessibility
      expect(html).toContain('aria-label="التنقل الرئيسي"');
      expect(html).toContain('dir="rtl"');
    });

    it("marks active link with aria-current='page'", () => {
      currentRole = Role.ADMIN;
      currentPathname = "/dashboard";
      const html = renderToStaticMarkup(<SidebarContent />);

      expect(html).toContain('aria-current="page"');
      expect(html).toContain('href="/dashboard"');
    });

    it("renders comingSoon items as disabled spans with accessible labels", () => {
      currentRole = Role.ADMIN;
      const html = renderToStaticMarkup(<SidebarContent />);

      // comingSoon items must NOT be clickable links, but aria-disabled spans
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain("قريباً");
      expect(html).toContain("بانتظار دمج مسار الإنتاج");
    });
  });

  describe("WAREHOUSE_STAFF Role Navigation", () => {
    it("renders warehouse, inventory, and router items, but strictly denies IP and Employee management", () => {
      currentRole = Role.WAREHOUSE_STAFF;
      const html = renderToStaticMarkup(<SidebarContent />);

      // Permitted Phase 2 view sections
      expect(html).toContain("المخازن");
      expect(html).toContain("المخزون");
      expect(html).toContain("الراوترات");

      // Denied sections
      expect(html).not.toContain("الموظفون");
      expect(html).not.toContain("عناوين IP");
      expect(html).not.toContain("الحضور");
      expect(html).not.toContain("لوحة التحكم");
    });
  });

  describe("CS (Customer Service) Role Navigation", () => {
    it("renders warehouses, inventory, routers, customers, and tickets, but strictly denies IP and Employee management", () => {
      currentRole = Role.CS;
      const html = renderToStaticMarkup(<SidebarContent />);

      // Permitted view items in Phase 2 matrix
      expect(html).toContain("المخازن");
      expect(html).toContain("المخزون");
      expect(html).toContain("الراوترات");
      expect(html).toContain("العملاء");
      expect(html).toContain("التذاكر");

      // Denied sections
      expect(html).not.toContain("الموظفون");
      expect(html).not.toContain("عناوين IP");
      expect(html).not.toContain("الحضور");
      expect(html).not.toContain("لوحة التحكم");
    });
  });

  describe("TECHNICIAN Role Navigation", () => {
    it("renders IP addresses and routers, but strictly denies warehouses, inventory, and employees", () => {
      currentRole = Role.TECHNICIAN;
      const html = renderToStaticMarkup(<SidebarContent />);

      // Permitted items for technician
      expect(html).toContain("عناوين IP");
      expect(html).toContain("الراوترات");

      // Denied items for technician (checking item titles/labels rather than section header substring)
      expect(html).not.toContain('title="المخازن (قريباً');
      expect(html).not.toContain('title="المخزون (قريباً');
      expect(html).not.toContain("الموظفون");
      expect(html).not.toContain("الحضور");
      expect(html).not.toContain("لوحة التحكم");
    });
  });

  describe("Unauthenticated / Missing Role", () => {
    it("renders empty navigation when no role is present", () => {
      currentRole = undefined;
      const html = renderToStaticMarkup(<SidebarContent />);

      expect(html).not.toContain("لوحة التحكم");
      expect(html).not.toContain("الموظفون");
      expect(html).not.toContain('title="المخازن (قريباً');
      expect(html).not.toContain("عناوين IP");
    });
  });
});
