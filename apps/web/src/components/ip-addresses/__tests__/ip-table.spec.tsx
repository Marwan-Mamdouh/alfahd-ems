import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpStatus } from "@alfahd/types";
import { IpTable } from "../ip-table";
import type { IpAddressRow } from "../types";

describe("IpTable Component (Task B6 / F6)", () => {
  const mockFreeIp: IpAddressRow = {
    id: "ip-1",
    address: "192.168.1.10",
    status: IpStatus.FREE,
    isArchived: false,
    customerId: null,
    notes: "Free address for allocation",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  };

  const mockReservedIp: IpAddressRow = {
    id: "ip-2",
    address: "192.168.1.20",
    status: IpStatus.RESERVED,
    isArchived: false,
    customerId: "cust-1",
    notes: "Assigned to VIP customer",
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  };

  const mockArchivedIp: IpAddressRow = {
    id: "ip-3",
    address: "10.0.0.1",
    status: IpStatus.FREE,
    isArchived: true,
    customerId: null,
    notes: "Decommissioned subnet",
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-03T10:00:00Z",
  };

  it("renders table with IPv4 addresses, operational statuses, and separate archival badges", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp, mockReservedIp, mockArchivedIp]} canManage={true} />
    );

    expect(html).toContain("192.168.1.10");
    expect(html).toContain("ip-status-free-ip-1");
    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("ip-active-badge-ip-1");
    expect(html).toContain("نشط");

    expect(html).toContain("192.168.1.20");
    expect(html).toContain("ip-status-reserved-ip-2");
    expect(html).toContain("محجوز (RESERVED)");

    expect(html).toContain("10.0.0.1");
    expect(html).toContain("ip-archived-badge-ip-3");
    expect(html).toContain("مؤرشف");
  });

  it("strictly suppresses action buttons and history for TECHNICIAN role (canManage=false)", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp, mockReservedIp, mockArchivedIp]} canManage={false} />
    );

    expect(html).toContain("192.168.1.10");
    expect(html).toContain("192.168.1.20");
    expect(html).not.toContain("الإجراءات");
    expect(html).not.toContain("reserve-btn");
    expect(html).not.toContain("release-btn");
    expect(html).not.toContain("archive-btn");
    expect(html).not.toContain("unarchive-btn");
    expect(html).not.toContain("edit-notes-btn");
    expect(html).not.toContain("history-btn");
  });

  it("shows reserve, archive, edit-notes, and history for active FREE IP in ADMIN view", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockFreeIp]} canManage={true} />
    );

    expect(html).toContain("reserve-btn-ip-1");
    expect(html).not.toContain("release-btn-ip-1");
    expect(html).toContain("archive-btn-ip-1");
    expect(html).not.toContain("unarchive-btn-ip-1");
    expect(html).toContain("edit-notes-btn-ip-1");
    expect(html).toContain("history-btn-ip-1");
  });

  it("shows release and disables archive button for RESERVED IP address (conflict enforcement)", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockReservedIp]} canManage={true} />
    );

    expect(html).toContain("release-btn-ip-2");
    expect(html).not.toContain("reserve-btn-ip-2");
    expect(html).toContain("archive-btn-ip-2");
    expect(html).toContain("disabled");
    expect(html).toContain("لا يمكن أرشفة عنوان محجوز. حرره أولاً.");
  });

  it("shows unarchive and hides reserve/archive for archived FREE IP", () => {
    const html = renderToStaticMarkup(
      <IpTable items={[mockArchivedIp]} canManage={true} />
    );

    expect(html).toContain('data-testid="unarchive-btn-ip-3"');
    expect(html).toContain("إلغاء الأرشفة");
    expect(html).not.toContain('data-testid="reserve-btn-ip-3"');
    expect(html).not.toContain('data-testid="archive-btn-ip-3"');
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
