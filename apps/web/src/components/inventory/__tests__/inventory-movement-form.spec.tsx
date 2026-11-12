import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  InventoryMovementForm,
  type ItemSelectOption,
  type SelectOption,
} from "../inventory-movement-form";
import { Role } from "@alfahd/types";

describe("InventoryMovementForm Component", () => {
  const mockItems: ItemSelectOption[] = [
    { id: "item-1", name: "كابل إنترنت CAT6", isSerialized: false },
    { id: "item-2", name: "راوتر TP-Link Archer C6", isSerialized: true },
  ];

  const mockWarehouses: SelectOption[] = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الجيزة" },
  ];

  it("renders default INBOUND_SUPPLIER form with supplier and warehouse inputs", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementForm
        items={mockItems}
        warehouses={mockWarehouses}
        technicians={[]}
        userRole={Role.ADMIN}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("اسم المورد *");
    expect(html).toContain("المخزن *");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).not.toContain("الفني المستلم *");
  });

  it("renders disabled technician selector and warning notice for OUTBOUND_TECHNICIAN when technicians list is empty", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementForm
        items={mockItems}
        warehouses={mockWarehouses}
        technicians={[]}
        userRole={Role.ADMIN}
        initialType="OUTBOUND_TECHNICIAN"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("الفني المستلم *");
    expect(html).toContain("لا يوجد فنيين نشطين متاحين");
    expect(html).toContain("لا يمكن إتمام العملية لعدم وجود فنيين نشطين مسجلين في النظام.");
    expect(html).toContain("disabled");
  });

  it("renders populated technician options for OUTBOUND_TECHNICIAN when technicians are available", () => {
    const mockTechnicians: SelectOption[] = [
      { id: "tech-1", name: "محمود أحمد (فني شبكات)" },
      { id: "tech-2", name: "علي حسن (فني صيانة)" },
    ];

    const html = renderToStaticMarkup(
      <InventoryMovementForm
        items={mockItems}
        warehouses={mockWarehouses}
        technicians={mockTechnicians}
        userRole={Role.ADMIN}
        initialType="OUTBOUND_TECHNICIAN"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("الفني المستلم *");
    expect(html).toContain("محمود أحمد (فني شبكات)");
    expect(html).toContain("علي حسن (فني صيانة)");
    expect(html).not.toContain("لا يوجد فنيين نشطين متاحين");
  });

  it("renders disabled technician selector and warning for RETURN_TECHNICIAN when technicians list is empty", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementForm
        items={mockItems}
        warehouses={mockWarehouses}
        technicians={[]}
        userRole={Role.ADMIN}
        initialType="RETURN_TECHNICIAN"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("الفني المرتجع منه *");
    expect(html).toContain("لا يوجد فنيين نشطين متاحين");
    expect(html).toContain("لا يمكن إتمام العملية لعدم وجود فنيين نشطين مسجلين في النظام.");
  });

  it("renders destination warehouse selection for TRANSFER_WAREHOUSE", () => {
    const html = renderToStaticMarkup(
      <InventoryMovementForm
        items={mockItems}
        warehouses={mockWarehouses}
        technicians={[]}
        userRole={Role.ADMIN}
        initialType="TRANSFER_WAREHOUSE"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("المخزن المصدر *");
    expect(html).toContain("المخزن المستلم (الوجهة) *");
    expect(html).toContain("الكمية المحولة *");
  });
});

