import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportSummary } from "../import-summary";

describe("ImportSummary Component", () => {
  it("renders accurate counts for inserted, skipped, and failed items", () => {
    const html = renderToStaticMarkup(
      <ImportSummary
        inserted={15}
        skipped={3}
        errors={[{ row: 4, address: "10.0.0.99", reason: "Duplicate IP address in database" }]}
      />
    );

    expect(html).toContain("15");
    expect(html).toContain("3");
    expect(html).toContain("1");
    // Total evaluated rows = 15 + 3 + 1 = 19
    expect(html).toContain("19");
    expect(html).toContain("View 1 Failed Row Details");
  });

  it("renders 0 failed rows cleanly when no errors exist", () => {
    const html = renderToStaticMarkup(
      <ImportSummary inserted={25} skipped={0} errors={[]} />
    );

    expect(html).toContain("25");
    expect(html).toContain("0");
    // Errors accordion button should not be rendered
    expect(html).not.toContain("View");
    expect(html).not.toContain("Failed Row Details");
  });
});
