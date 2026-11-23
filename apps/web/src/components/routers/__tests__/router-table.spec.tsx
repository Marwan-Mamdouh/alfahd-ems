import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterTable } from "../router-table";
import type { RouterRow, RouterStatus, RouterPhysicalCondition } from "../types";

describe("RouterTable Component", () => {
  const baseRouter: RouterRow = {
    id: "router-1",
    serialNumber: "RT-2026-0001",
    productId: "p-1",
    productName: "TP-Link AX1500",
    productSku: "TPL-AX1500",
    productModel: "Archer AX10",
    status: "AVAILABLE",
    physicalCondition: "SERVICEABLE",
    warehouseId: "wh-1",
    warehouseName: "المخزن الرئيسي",
    externalLocation: null,
    currentHolderType: "WAREHOUSE",
    currentHolderId: "wh-1",
    currentHolderName: "المخزن الرئيسي",
    notes: "جهاز ممتاز",
    createdAt: "2026-01-15T10:00:00Z",
  };

  it("renders table with router rows and details", () => {
    const html = renderToStaticMarkup(
      <RouterTable
        routers={[baseRouter]}
        isLoading={false}
        error={null}
        onRouterClick={vi.fn()}
      />
    );

    expect(html).toContain("RT-2026-0001");
    expect(html).toContain("TP-Link AX1500");
    expect(html).toContain("Archer AX10");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("متاح بالمخزن");
  });

  it("renders all eight lifecycle statuses correctly", () => {
    const statuses: RouterStatus[] = [
      "AVAILABLE",
      "ASSIGNED_TO_TECHNICIAN",
      "INSTALLED_AT_CUSTOMER",
      "RETURNED",
      "DAMAGED",
      "UNDER_REPAIR",
      "LOST",
      "DECOMMISSIONED",
    ];

    const routers: RouterRow[] = statuses.map((status, index) => ({
      ...baseRouter,
      id: `router-status-${index}`,
      serialNumber: `SN-STATUS-${index}`,
      status,
    }));

    const html = renderToStaticMarkup(
      <RouterTable routers={routers} isLoading={false} error={null} />
    );

    expect(html).toContain("متاح بالمخزن");
    expect(html).toContain("بعهدة الفني");
    expect(html).toContain("مركب لدى عميل");
    expect(html).toContain("مرتجع للمخزن");
    expect(html).toContain("تالف");
    expect(html).toContain("قيد الصيانة");
    expect(html).toContain("مفقود");
    expect(html).toContain("مكهن / خارج الخدمة");
  });

  it("renders all three physical conditions and distinct styling for DAMAGED", () => {
    const conditions: RouterPhysicalCondition[] = [
      "SERVICEABLE",
      "DAMAGED",
      "UNDER_REPAIR",
    ];

    const routers: RouterRow[] = conditions.map((physicalCondition, index) => ({
      ...baseRouter,
      id: `router-cond-${index}`,
      serialNumber: `SN-COND-${index}`,
      physicalCondition,
    }));

    const html = renderToStaticMarkup(
      <RouterTable routers={routers} isLoading={false} error={null} />
    );

    expect(html).toContain("سليم");
    expect(html).toContain("تالف");
    expect(html).toContain("قيد الإصلاح");
    // Verify distinct styling for damaged condition
    expect(html).toContain("text-red-700");
  });

  it("renders empty custody status when currentHolderType is null or missing", () => {
    const noCustodyRouter: RouterRow = {
      ...baseRouter,
      currentHolderType: null,
      currentHolderId: null,
      currentHolderName: null,
    };

    const html = renderToStaticMarkup(
      <RouterTable routers={[noCustodyRouter]} isLoading={false} error={null} />
    );

    expect(html).toContain("بدون عهدة");
  });

  it("renders external location when router is at external repair", () => {
    const externalRepairRouter: RouterRow = {
      ...baseRouter,
      status: "UNDER_REPAIR",
      warehouseId: null,
      warehouseName: null,
      externalLocation: "مركز صيانة توكيل معتمد",
    };

    const html = renderToStaticMarkup(
      <RouterTable
        routers={[externalRepairRouter]}
        isLoading={false}
        error={null}
      />
    );

    expect(html).toContain("مركز صيانة توكيل معتمد");
  });

  it("renders loading state", () => {
    const html = renderToStaticMarkup(
      <RouterTable routers={[]} isLoading={true} error={null} />
    );

    expect(html).toContain("جارٍ التحميل...");
  });

  it("renders error state with retry callback option", () => {
    const html = renderToStaticMarkup(
      <RouterTable
        routers={[]}
        isLoading={false}
        error={new Error("فشل الاتصال بقاعدة البيانات")}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("فشل الاتصال بقاعدة البيانات");
    expect(html).toContain("إعادة المحاولة");
  });

  it("renders empty state when list is empty", () => {
    const html = renderToStaticMarkup(
      <RouterTable routers={[]} isLoading={false} error={null} />
    );

    expect(html).toContain("لا توجد أجهزة راوتر");
  });

  it("renders pagination controls when page and total are provided", () => {
    const html = renderToStaticMarkup(
      <RouterTable
        routers={[baseRouter]}
        isLoading={false}
        error={null}
        page={2}
        pageSize={10}
        total={35}
        onPageChange={vi.fn()}
      />
    );

    expect(html).toContain("صفحة ٢ من ٤");
    expect(html).toContain("السابق");
    expect(html).toContain("التالي");
  });
});
