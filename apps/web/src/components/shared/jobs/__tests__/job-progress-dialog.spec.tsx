import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role } from "@alfahd/types";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-slot="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { JobProgressDialog } from "../job-progress-dialog";

describe("JobProgressDialog ADMIN gate", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    useAuthStore.getState().clearSession();
  });

  it("renders disabled upload button and warning message when user is not ADMIN", () => {
    useAuthStore.setState({
      user: {
        id: "tech-1",
        email: "tech@alfahd.local",
        role: Role.TECHNICIAN,
        isActive: true,
        createdAt: "2026-01-01",
      },
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <JobProgressDialog
          open={true}
          onOpenChange={vi.fn()}
          mode="import"
          title="Import IP Addresses"
          uploadEndpoint="/api/ip-addresses/import"
        />
      </QueryClientProvider>
    );

    expect(html).toContain("عذراً، عمليات الاستيراد والتقارير مقتصرة على مديري النظام فقط (ADMIN)");
    expect(html).toContain("disabled");
  });

  it("renders upload button without warning when user is ADMIN", () => {
    useAuthStore.setState({
      user: {
        id: "admin-1",
        email: "admin@alfahd.local",
        role: Role.ADMIN,
        isActive: true,
        createdAt: "2026-01-01",
      },
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <JobProgressDialog
          open={true}
          onOpenChange={vi.fn()}
          mode="import"
          title="Import IP Addresses"
          uploadEndpoint="/api/ip-addresses/import"
        />
      </QueryClientProvider>
    );

    expect(html).not.toContain("عذراً، عمليات الاستيراد والتقارير مقتصرة على مديري النظام فقط (ADMIN)");
  });
});
