import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpStatusBadge } from "../ip-status-badge";

describe("IpStatusBadge Component (Task F6)", () => {
  it("renders FREE and active status badge correctly", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status="FREE" isArchived={false} />
    );

    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("status-badge-free");
    expect(html).toContain("نشط");
    expect(html).toContain("status-badge-active");
  });

  it("renders RESERVED and active status badge correctly", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status="RESERVED" isArchived={false} />
    );

    expect(html).toContain("محجوز (RESERVED)");
    expect(html).toContain("status-badge-reserved");
    expect(html).toContain("نشط");
    expect(html).toContain("status-badge-active");
  });

  it("renders FREE and archived status badge correctly", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status="FREE" isArchived={true} />
    );

    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("مؤرشف");
    expect(html).toContain("status-badge-archived");
  });

  it("renders custom className when provided", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status="FREE" isArchived={false} className="custom-test-class" />
    );

    expect(html).toContain("custom-test-class");
  });
});
