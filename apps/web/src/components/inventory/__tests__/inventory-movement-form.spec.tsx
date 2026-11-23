import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryMovementForm } from "../inventory-movement-form";
import type { ItemSelectOption, SelectOption } from "../types";
import { Role } from "@alfahd/types";

describe("InventoryMovementForm Component — Five Movement Workflows & Guardrails", () => {
  const mockItems: ItemSelectOption[] = [
    { id: "item-1", name: "كابل إنترنت CAT6", isSerialized: false },
    { id: "item-2", name: "راوتر TP-Link Archer C6", isSerialized: true },
    { id: "item-3", name: "محول ألياف بصرية SFP", isSerialized: false },
  ];

  const mockWarehouses: SelectOption[] = [
    { id: "wh-1", name: "المخزن الرئيسي" },
    { id: "wh-2", name: "مخزن الجيزة" },
  ];

  const mockTechnicians: SelectOption[] = [
    { id: "tech-1", name: "محمود أحمد (فني شبكات)" },
    { id: "tech-2", name: "علي حسن (فني صيانة)" },
  ];

  describe("1. INBOUND_SUPPLIER Workflow", () => {
    it("renders default INBOUND_SUPPLIER form with supplier and warehouse inputs", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("وارد مورد");
      expect(html).toContain("اسم المورد *");
      expect(html).toContain("المخزن *");
      expect(html).toContain("المخزن الرئيسي");
      expect(html).not.toContain("الفني المستلم *");
    });
  });

  describe("2. OUTBOUND_TECHNICIAN Workflow", () => {
    it("renders technician selector when technicians are available", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.WAREHOUSE_STAFF}
          initialType="OUTBOUND_TECHNICIAN"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("صرف لفني");
      expect(html).toContain("مخزن الصرف *");
      expect(html).toContain("الفني المستلم *");
      expect(html).toContain("محمود أحمد (فني شبكات)");
      expect(html).toContain("علي حسن (فني صيانة)");
      expect(html).not.toContain("اسم المورد *");
    });

    it("renders disabled technician selector and warning notice when technicians list is empty", () => {
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
  });

  describe("3. RETURN_TECHNICIAN Workflow", () => {
    it("renders return warehouse and technician selector", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.WAREHOUSE_STAFF}
          initialType="RETURN_TECHNICIAN"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("مرتجع فني");
      expect(html).toContain("مخزن الاستلام *");
      expect(html).toContain("الفني المرتجع منه *");
      expect(html).toContain("محمود أحمد (فني شبكات)");
    });
  });

  describe("4. TRANSFER_WAREHOUSE Workflow", () => {
    it("renders source warehouse and destination warehouse inputs", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.WAREHOUSE_STAFF}
          initialType="TRANSFER_WAREHOUSE"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("تحويل مخزني");
      expect(html).toContain("المخزن المصدر *");
      expect(html).toContain("المخزن المستلم (الوجهة) *");
      expect(html).toContain("الكمية المحولة *");
    });

    it("displays error when same warehouse transfer is flagged", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.WAREHOUSE_STAFF}
          initialType="TRANSFER_WAREHOUSE"
          fieldErrors={{
            toWarehouseId: "لا يمكن التحويل لنفس المخزن المصدر. يرجى اختيار مخزن مختلف.",
          }}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("لا يمكن التحويل لنفس المخزن المصدر. يرجى اختيار مخزن مختلف.");
    });
  });

  describe("5. ADJUSTMENT Workflow (Admin Only)", () => {
    it("renders adjustment options and mandatory justification note for ADMIN", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          initialType="ADJUSTMENT"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("تسوية جردية");
      expect(html).toContain("الرصيد الفعلي بعد الجرد *");
      expect(html).toContain("ملاحظات ومبررات التسوية الجردية (إجباري) *");
      expect(html).toContain("مدراء فقط");
    });

    it("hides ADJUSTMENT movement option from non-admin users", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.WAREHOUSE_STAFF}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).not.toContain("تسوية جردية");
      expect(html).not.toContain("الرصيد الفعلي بعد الجرد *");
    });

    it("displays validation error when mandatory adjustment reason is missing", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          initialType="ADJUSTMENT"
          fieldErrors={{
            notes: "ملاحظات ومبررات التسوية الجردية مطلوبة إجباريًا لأغراض التدقيق الرقابي.",
          }}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("ملاحظات ومبررات التسوية الجردية مطلوبة إجباريًا لأغراض التدقيق الرقابي.");
    });
  });

  describe("Phase 4: Serialized Stock Restrictions", () => {
    it("indicates serialized items in the select dropdown", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("راوتر TP-Link Archer C6 (جهاز متبع بالسيريال)");
    });

    it("shows serialized restriction error when a serialized product is selected", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          fieldErrors={{
            itemId: "لا يمكن إجراء حركة كمية على صنف متتبع بالسيريال.",
          }}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("لا يمكن إجراء حركة كمية على صنف متتبع بالسيريال.");
    });
  });

  describe("Form Protection & Error Handling", () => {
    it("disables submit button and shows loading spinner when isSubmitting is true", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          isSubmitting={true}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("جاري التسجيل...");
      expect(html).toContain("disabled");
    });

    it("renders server error alert and preserves input states", () => {
      const html = renderToStaticMarkup(
        <InventoryMovementForm
          items={mockItems}
          warehouses={mockWarehouses}
          technicians={mockTechnicians}
          userRole={Role.ADMIN}
          serverError="الكمية المطلوبة تتجاوز الرصيد المتاح في المخزن"
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("فشلت العملية");
      expect(html).toContain("الكمية المطلوبة تتجاوز الرصيد المتاح في المخزن");
      expect(html).toContain("role=\"alert\"");
    });
  });
});
