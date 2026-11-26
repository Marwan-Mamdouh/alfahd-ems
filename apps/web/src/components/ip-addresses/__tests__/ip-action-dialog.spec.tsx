import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpStatus } from "@alfahd/types";
import { IpActionDialog, buildActionDialogContextKey } from "../ip-action-dialog";
import type { IpAddressRow } from "../types";

describe("IpActionDialog Component (Task F6)", () => {
  const mockFreeIp: IpAddressRow = {
    id: "ip-1",
    address: "192.168.1.100",
    status: IpStatus.FREE,
    isArchived: false,
    customerId: null,
    notes: "Available host",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  };

  const mockReservedIp: IpAddressRow = {
    id: "ip-2",
    address: "10.0.0.50",
    status: IpStatus.RESERVED,
    isArchived: false,
    customerId: "cust-1",
    notes: "Assigned customer host",
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  };

  const mockArchivedIp: IpAddressRow = {
    id: "ip-3",
    address: "172.16.0.1",
    status: IpStatus.FREE,
    isArchived: true,
    customerId: null,
    notes: "Decommissioned subnet",
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-03T10:00:00Z",
  };

  it("returns null when isOpen is false or ip/action is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <IpActionDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="reserve"
        ip={mockFreeIp}
      />
    );
    expect(htmlClosed).toBe("");

    const htmlNoAction = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action={null}
        ip={mockFreeIp}
      />
    );
    expect(htmlNoAction).toBe("");
  });

  it("renders reserve dialog with title, UI primitives, description, and action button", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="reserve"
        ip={mockFreeIp}
      />
    );

    expect(html).toContain("تأكيد حجز عنوان IP");
    expect(html).toContain("192.168.1.100");
    expect(html).toContain("تأكيد الحجز");
    expect(html).toContain("action-reason-input");
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('data-slot="label"');
    expect(html).toContain('data-slot="button"');
  });

  it("renders release dialog with title and confirm button", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="release"
        ip={mockReservedIp}
      />
    );

    expect(html).toContain("تأكيد تحرير عنوان IP");
    expect(html).toContain("10.0.0.50");
    expect(html).toContain("تأكيد التحرير");
  });

  it("blocks archiving and disables confirm button when IP status is RESERVED", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="archive"
        ip={mockReservedIp}
      />
    );

    expect(html).toContain("لا يمكن إتمام الأرشفة");
    expect(html).toContain(
      "هذا العنوان محجوز حالياً (RESERVED). يجب تحرير العنوان أولاً قبل التمكن من أرشفته."
    );
    expect(html).toContain("disabled");
  });

  it("allows archiving when IP status is FREE", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="archive"
        ip={mockFreeIp}
      />
    );

    expect(html).toContain("تأكيد أرشفة عنوان IP");
    expect(html).toContain("تأكيد الأرشفة");
    expect(html).not.toContain("لا يمكن إتمام الأرشفة");
  });

  it("renders unarchive dialog correctly", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="unarchive"
        ip={mockArchivedIp}
      />
    );

    expect(html).toContain("تأكيد إلغاء أرشفة عنوان IP");
    expect(html).toContain("172.16.0.1");
    expect(html).toContain("تأكيد إلغاء الأرشفة");
  });

  it("renders error message banner when error occurs", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="reserve"
        ip={mockFreeIp}
        errorMessage="حدث تعارض أثناء حجز العنوان (409 Conflict)"
      />
    );

    expect(html).toContain("ip-action-error");
    expect(html).toContain("حدث تعارض أثناء حجز العنوان (409 Conflict)");
  });

  it("disables controls and displays loading state during submission (prevents double-submit)", () => {
    const html = renderToStaticMarkup(
      <IpActionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        action="reserve"
        ip={mockFreeIp}
        isSubmitting={true}
      />
    );

    expect(html).toContain("جاري التنفيذ...");
    expect(html).toContain("disabled");
  });

  it("derives distinct context keys when open state, action, or target IP changes to prevent reason state leaks", () => {
    const k1 = buildActionDialogContextKey(true, "reserve", "ip-1");
    const k2 = buildActionDialogContextKey(true, "release", "ip-1");
    const k3 = buildActionDialogContextKey(true, "reserve", "ip-2");
    const k4 = buildActionDialogContextKey(false, "reserve", "ip-1");

    expect(new Set([k1, k2, k3, k4]).size).toBe(4);
  });
});
