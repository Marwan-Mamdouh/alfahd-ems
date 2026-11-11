import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpTable } from "../ip-table";
import type { IpAddressRow } from "../types";

describe("IpTable Component (Task B6)", () => {
  const mockFreeIp: IpAddressRow = {
    id: "ip-1",
    address: "192.168.1.10",
    status: "FREE",
    isArchived: false,
    customerId: null,
    notes: "Free address for allocation",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  };

  const mockReservedIp: IpAddressRow = {
    id: "ip-2",
    address: "192.168.1.20",
    status: "RESERVED",
    isArchived: false,
    customerId: "cust-1",
    notes: "Assigned to VIP customer",
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  };

  const mockArchivedIp: IpAddressRow = {
    id: "ip-3",
    address: "10.0.0.1",
    status: "FREE",
    isArchived: true,
    customerId: null,
    notes: "Decommissioned subnet",
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-03T10:00:00Z",
  };

  it("renders table with IPv4 addresses, statuses, and badges", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp, mockReservedIp, mockArchivedIp]} canManage={true} />
    );

    expect(html).toContain("192.168.1.10");
    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("نشط");

    expect(html).toContain("192.168.1.20");
    expect(html).toContain("محجوز (RESERVED)");

    expect(html).toContain("10.0.0.1");
    expect(html).toContain("مؤرشف");
  });

  it("strictly suppresses action buttons for TECHNICIAN role (canManage=false)", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp, mockReservedIp]} canManage={false} />
    );

    expect(html).not.toContain("الإجراءات");
    expect(html).not.toContain("reserve-btn");
    expect(html).not.toContain("release-btn");
    expect(html).not.toContain("archive-btn");
    expect(html).not.toContain("edit-notes-btn");
    expect(html).not.toContain("history-btn");
  });

  it("disables archive button for RESERVED IP address (invariant enforcement)", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockReservedIp]} canManage={true} />
    );

    expect(html).toContain("disabled");
    expect(html).toContain("لا يمكن أرشفة عنوان محجوز. حرره أولاً.");
  });

  it("enables archive button for FREE and unarchived IP", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp]} canManage={true} />
    );

    expect(html).toContain("archive-btn-ip-1");
    expect(html).toContain("أرشفة العنوان");
  });

  it("renders unarchive button for archived IP", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockArchivedIp]} canManage={true} />
    );

    expect(html).toContain("unarchive-btn-ip-3");
    expect(html).toContain("إلغاء الأرشفة");
  });

  it("renders loading state", () => {
    const html = renderToStaticMarkup(<IpTable items={[]} isLoading={true} />);
    expect(html).toContain("ip-table-loading");
    expect(html).toContain("جاري تحميل بيانات عناوين IP...");
  });

  it("renders empty state when no records exist", () => {
    const html = renderToStaticMarkup(<IpTable items={[]} isLoading={false} />);
    expect(html).toContain("ip-table-empty");
    expect(html).toContain("لا توجد عناوين IP مطابقة");
  });
});
