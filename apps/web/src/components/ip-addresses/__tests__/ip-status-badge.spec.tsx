import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpStatus } from "@alfahd/types";
import {
  IpStatusBadge,
  IpOperationalStatusBadge,
  IpArchivedStatusBadge,
} from "../ip-status-badge";

describe("IpStatusBadge Component (Task F6)", () => {
  it("renders FREE and active status badge correctly", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status={IpStatus.FREE} isArchived={false} />
    );

    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("status-badge-free");
    expect(html).toContain("نشط");
    expect(html).toContain("status-badge-active");
  });

  it("renders RESERVED and active status badge correctly", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status={IpStatus.RESERVED} isArchived={false} />
    );

    expect(html).toContain("محجوز (RESERVED)");
    expect(html).toContain("status-badge-reserved");
    expect(html).toContain("نشط");
    expect(html).toContain("status-badge-active");
  });

  it("renders FREE and archived status badge separately", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge status={IpStatus.FREE} isArchived={true} />
    );

    expect(html).toContain("متاح (FREE)");
    expect(html).toContain("مؤرشف");
    expect(html).toContain("status-badge-archived");
  });

  it("renders standalone operational and archival badges using shared StatusBadge", () => {
    const opHtml = renderToStaticMarkup(
      <IpOperationalStatusBadge status={IpStatus.RESERVED} testId="custom-op" />
    );
    const archHtml = renderToStaticMarkup(
      <IpArchivedStatusBadge isArchived={true} testId="custom-arch" />
    );

    expect(opHtml).toContain("محجوز (RESERVED)");
    expect(opHtml).toContain('data-testid="custom-op"');
    expect(archHtml).toContain("مؤرشف");
    expect(archHtml).toContain('data-testid="custom-arch"');
  });

  it("renders custom className when provided", () => {
    const html = renderToStaticMarkup(
      <IpStatusBadge
        status={IpStatus.FREE}
        isArchived={false}
        className="custom-test-class"
      />
    );

    expect(html).toContain("custom-test-class");
  });
});
