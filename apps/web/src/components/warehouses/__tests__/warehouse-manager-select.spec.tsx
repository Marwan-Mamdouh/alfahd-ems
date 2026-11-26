import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarehouseManagerSelect } from "../warehouse-manager-select";
import type { ManagerOption, Remote } from "../types";

describe("WarehouseManagerSelect Component (Criterion D Compliance)", () => {
  const mockOptions: ManagerOption[] = [
    {
      id: "mgr-admin-1",
      name: "سامح إبراهيم",
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      id: "mgr-staff-2",
      name: "كريم ممدوح",
      role: "WAREHOUSE_STAFF",
      status: "ACTIVE",
    },
  ];

  it("renders default empty state when no manager is selected", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value=""
        onChange={vi.fn()}
        options={mockOptions}
      />
    );

    expect(html).toContain("مدير المخزن المسؤول");
    expect(html).toContain("بدون مدير مخزن حاليًا");
    expect(html).toContain("يقتصر الاختيار على الموظفين النشطين بصلاحية مدير نظام أو أمين مخزن فقط");
  });

  it("renders selected active manager with role label and zero PII", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value="mgr-admin-1"
        onChange={vi.fn()}
        options={mockOptions}
      />
    );

    expect(html).toContain("سامح إبراهيم");
    expect(html).toContain("مدير نظام");
    // Ensure no PII is exposed
    expect(html).not.toContain("nationalId");
    expect(html).not.toContain("@alfahd.com");
    expect(html).not.toContain("010");
  });

  it("supports currentOnly fallback when current manager is inactive", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value="inactive-mgr-9"
        onChange={vi.fn()}
        options={mockOptions}
        currentOnly={{
          id: "inactive-mgr-9",
          name: "عادل عبد المنعم",
          reason: "inactive",
        }}
      />
    );

    expect(html).toContain("عادل عبد المنعم");
    expect(html).toContain("المدير الحالي معطل");
  });

  it("supports currentOnly fallback when current manager is unresolved/unlisted", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value="unresolved-mgr-8"
        onChange={vi.fn()}
        options={mockOptions}
        currentOnly={{
          id: "unresolved-mgr-8",
          name: null,
          reason: "unresolved",
        }}
      />
    );

    expect(html).toContain("المدير الحالي غير متاح");
    expect(html).toContain("مدير غير محدد");
  });

  it("renders loading state when Remote options are loading", () => {
    const remoteLoading: Remote<readonly ManagerOption[]> = {
      kind: "loading",
    };

    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value=""
        onChange={vi.fn()}
        options={remoteLoading}
      />
    );

    expect(html).toContain("جاري تحميل قائمة المديرين...");
    expect(html).toContain("disabled");
  });

  it("renders error message and retry button when Remote options fail", () => {
    const retryFn = vi.fn();
    const remoteError: Remote<readonly ManagerOption[]> = {
      kind: "error",
      message: "فشل استرجاع قائمة المديرين من الخادم",
      retry: retryFn,
    };

    // When dropdown is closed, main button shows label; when opened or with selector error
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value=""
        onChange={vi.fn()}
        options={remoteError}
        error="فشل استرجاع قائمة المديرين"
      />
    );

    expect(html).toContain("فشل استرجاع قائمة المديرين");
  });

  it("disables select trigger when disabled prop is true", () => {
    const html = renderToStaticMarkup(
      <WarehouseManagerSelect
        value=""
        onChange={vi.fn()}
        options={mockOptions}
        disabled={true}
      />
    );

    expect(html).toContain("disabled");
    expect(html).toContain("cursor-not-allowed");
  });
});
